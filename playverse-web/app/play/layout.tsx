// playverse-web/app/play/layout.tsx
export default function Layout({ children }: { children: React.ReactNode }) {
  // Evita headers/menus locales debajo del header global.
  return <>{children}</>;
}
