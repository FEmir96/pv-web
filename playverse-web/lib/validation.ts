// playverse-web/lib/validation.ts
export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

// Validación de nombre del titular
export function validateCardHolder(holder: string): ValidationError | null {
    if (!holder || holder.trim().length === 0) {
        return { field: 'holder', message: 'El nombre del titular es requerido' };
    }

    if (holder.trim().length < 2) {
        return { field: 'holder', message: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (holder.trim().length > 50) {
        return { field: 'holder', message: 'El nombre no puede exceder 50 caracteres' };
    }

    // Solo letras, espacios, guiones y apostrofes
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/;
    if (!nameRegex.test(holder.trim())) {
        return { field: 'holder', message: 'El nombre solo puede contener letras, espacios, guiones y apostrofes' };
    }

    return null;
}

// Validación de número de tarjeta
export function validateCardNumber(number: string): ValidationError | null {
    const cleanNumber = number.replace(/\s/g, '');

    if (!cleanNumber || cleanNumber.length === 0) {
        return { field: 'number', message: 'El número de tarjeta es requerido' };
    }

    // Solo números
    if (!/^\d+$/.test(cleanNumber)) {
        return { field: 'number', message: 'El número de tarjeta solo puede contener dígitos' };
    }

    // Longitud válida (13-19 dígitos)
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
        return { field: 'number', message: 'El número de tarjeta debe tener entre 13 y 19 dígitos' };
    }

    // Algoritmo de Luhn para validar tarjetas
    if (!luhnCheck(cleanNumber)) {
        return { field: 'number', message: 'El número de tarjeta no es válido' };
    }

    return null;
}

// Validación de fecha de expiración
export function validateExpirationDate(exp: string): ValidationError | null {
    if (!exp || exp.trim().length === 0) {
        return { field: 'exp', message: 'La fecha de expiración es requerida' };
    }

    // Formato MM/YY
    const expRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!expRegex.test(exp)) {
        return { field: 'exp', message: 'Formato inválido. Use MM/YY (ej: 12/25)' };
    }

    const [month, year] = exp.split('/');
    const expMonth = parseInt(month, 10);
    const expYear = parseInt('20' + year, 10);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Verificar que no esté vencida
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        return { field: 'exp', message: 'La tarjeta ha expirado' };
    }

    // Verificar que no sea más de 10 años en el futuro
    if (expYear > currentYear + 10) {
        return { field: 'exp', message: 'La fecha de expiración no puede ser más de 10 años en el futuro' };
    }

    return null;
}

export function formatExpirationInput(raw: string): string {
    const clean = (raw || '').replace(/\D/g, '').slice(0, 4);
    if (clean.length === 0) {
        return '';
    }

    if (clean.length === 1) {
        const digit = parseInt(clean, 10);
        if (Number.isFinite(digit) && digit > 1) {
            return `0${digit}`;
        }
        return clean;
    }

    let monthDigits = clean.slice(0, 2);
    const remainder = clean.slice(2);

    let monthValue = parseInt(monthDigits, 10);
    if (!Number.isFinite(monthValue) || monthValue <= 0) {
        monthValue = 1;
    } else if (monthValue > 12) {
        monthValue = 12;
    }
    const month = monthValue.toString().padStart(2, '0');

    if (remainder.length === 0) {
        return month;
    }

    return `${month}/${remainder}`;
}

// Validación de CVC
export function validateCVC(cvc: string): ValidationError | null {
    if (!cvc || cvc.trim().length === 0) {
        return { field: 'cvc', message: 'El CVC es requerido' };
    }

    // Solo números
    if (!/^\d+$/.test(cvc)) {
        return { field: 'cvc', message: 'El CVC solo puede contener dígitos' };
    }

    // Longitud válida (3-4 dígitos)
    if (cvc.length < 3 || cvc.length > 4) {
        return { field: 'cvc', message: 'El CVC debe tener 3 o 4 dígitos' };
    }

    return null;
}

// Validación completa del formulario de tarjeta
export function validatePaymentForm(data: {
    holder: string;
    number: string;
    exp: string;
    cvc: string;
}): ValidationResult {
    const errors: ValidationError[] = [];

    const holderError = validateCardHolder(data.holder);
    if (holderError) errors.push(holderError);

    const numberError = validateCardNumber(data.number);
    if (numberError) errors.push(numberError);

    const expError = validateExpirationDate(data.exp);
    if (expError) errors.push(expError);

    const cvcError = validateCVC(data.cvc);
    if (cvcError) errors.push(cvcError);

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Algoritmo de Luhn para validar números de tarjeta
function luhnCheck(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;

    // Iterar de derecha a izquierda
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber[i], 10);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

// Detectar tipo de tarjeta por número
export function detectCardType(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\s/g, '');

    if (/^4/.test(cleanNumber)) return 'visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'amex';
    if (/^6/.test(cleanNumber)) return 'discover';

    return 'unknown';
}

// Validación de email
export function validateEmail(email: string): ValidationError | null {
    if (!email || email.trim().length === 0) {
        return { field: 'email', message: 'El email es requerido' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return { field: 'email', message: 'Formato de email inválido' };
    }

    if (email.trim().length > 254) {
        return { field: 'email', message: 'El email no puede exceder 254 caracteres' };
    }

    return null;
}

// Validación de cantidad de semanas para alquiler
export function validateRentalWeeks(weeks: number): ValidationError | null {
    if (!weeks || weeks < 1) {
        return { field: 'weeks', message: 'Debe seleccionar al menos 1 semana' };
    }

    if (weeks > 52) {
        return { field: 'weeks', message: 'No se puede alquilar por más de 52 semanas' };
    }

    if (!Number.isInteger(weeks)) {
        return { field: 'weeks', message: 'El número de semanas debe ser un número entero' };
    }

    return null;
}

// Validación de precio
export function validatePrice(price: number): ValidationError | null {
    if (price === undefined || price === null) {
        return { field: 'price', message: 'El precio es requerido' };
    }

    if (price < 0) {
        return { field: 'price', message: 'El precio no puede ser negativo' };
    }

    if (price > 10000) {
        return { field: 'price', message: 'El precio no puede exceder $10,000' };
    }

    if (!Number.isFinite(price)) {
        return { field: 'price', message: 'El precio debe ser un número válido' };
    }

    return null;
}
