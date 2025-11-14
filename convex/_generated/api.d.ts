/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_ageRatingsNuke from "../actions/ageRatingsNuke.js";
import type * as actions_backfillCoversFromIGDB from "../actions/backfillCoversFromIGDB.js";
import type * as actions_backfillDetailsFromIGDB from "../actions/backfillDetailsFromIGDB.js";
import type * as actions_cleanupNotRated from "../actions/cleanupNotRated.js";
import type * as actions_contact from "../actions/contact.js";
import type * as actions_debugRawgSearch from "../actions/debugRawgSearch.js";
import type * as actions_debugSearchIgdb from "../actions/debugSearchIgdb.js";
import type * as actions_devPlanRemindersNow from "../actions/devPlanRemindersNow.js";
import type * as actions_devSweepNow from "../actions/devSweepNow.js";
import type * as actions_email from "../actions/email.js";
import type * as actions_fillUpcomingCoversFromIGDB from "../actions/fillUpcomingCoversFromIGDB.js";
import type * as actions_getIGDBScreenshots from "../actions/getIGDBScreenshots.js";
import type * as actions_massBackfillAgeRatings from "../actions/massBackfillAgeRatings.js";
import type * as actions_notifications_scheduleRentalExpiryReminders from "../actions/notifications/scheduleRentalExpiryReminders.js";
import type * as actions_passwordReset from "../actions/passwordReset.js";
import type * as actions_pushy from "../actions/pushy.js";
import type * as actions_refreshIGDBBatch from "../actions/refreshIGDBBatch.js";
import type * as actions_refreshIGDBRatingForGame from "../actions/refreshIGDBRatingForGame.js";
import type * as actions_refreshRAWGBatch from "../actions/refreshRAWGBatch.js";
import type * as actions_refreshRAWGRatingForGame from "../actions/refreshRAWGRatingForGame.js";
import type * as actions_translateExistingDescriptions from "../actions/translateExistingDescriptions.js";
import type * as ads from "../ads.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as games from "../games.js";
import type * as lib_avatars from "../lib/avatars.js";
import type * as lib_diffGame from "../lib/diffGame.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_gameCore from "../lib/gameCore.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_igdb_ageRatings from "../lib/igdb/ageRatings.js";
import type * as lib_igdb_auth from "../lib/igdb/auth.js";
import type * as lib_igdb_client from "../lib/igdb/client.js";
import type * as lib_igdb_token from "../lib/igdb/token.js";
import type * as lib_notifyTargets from "../lib/notifyTargets.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_rawg_age from "../lib/rawg/age.js";
import type * as lib_rawg_client from "../lib/rawg/client.js";
import type * as mutations_addFavorite from "../mutations/addFavorite.js";
import type * as mutations_addGame from "../mutations/addGame.js";
import type * as mutations_addGamesBatch from "../mutations/addGamesBatch.js";
import type * as mutations_admin_createGame from "../mutations/admin/createGame.js";
import type * as mutations_admin_deleteGame from "../mutations/admin/deleteGame.js";
import type * as mutations_admin_updateGame from "../mutations/admin/updateGame.js";
import type * as mutations_admin_updateProfile from "../mutations/admin/updateProfile.js";
import type * as mutations_applyAgeRating from "../mutations/applyAgeRating.js";
import type * as mutations_applyIgdbRating from "../mutations/applyIgdbRating.js";
import type * as mutations_authLogin from "../mutations/authLogin.js";
import type * as mutations_cancelPremiumPlan from "../mutations/cancelPremiumPlan.js";
import type * as mutations_cart from "../mutations/cart.js";
import type * as mutations_completeTrialCharge from "../mutations/completeTrialCharge.js";
import type * as mutations_contact from "../mutations/contact.js";
import type * as mutations_createGame from "../mutations/createGame.js";
import type * as mutations_createUser from "../mutations/createUser.js";
import type * as mutations_deleteGame from "../mutations/deleteGame.js";
import type * as mutations_deletePaymentMethod from "../mutations/deletePaymentMethod.js";
import type * as mutations_deleteUser from "../mutations/deleteUser.js";
import type * as mutations_devSetSubscriptionEndNow from "../mutations/devSetSubscriptionEndNow.js";
import type * as mutations_emitPlanRenewed from "../mutations/emitPlanRenewed.js";
import type * as mutations_ensurePlanConsistency from "../mutations/ensurePlanConsistency.js";
import type * as mutations_makePayment from "../mutations/makePayment.js";
import type * as mutations_preExpiryReminders from "../mutations/preExpiryReminders.js";
import type * as mutations_promoteToAdmin from "../mutations/promoteToAdmin.js";
import type * as mutations_removeFavorite from "../mutations/removeFavorite.js";
import type * as mutations_rentGame from "../mutations/rentGame.js";
import type * as mutations_restoreGameTitles from "../mutations/restoreGameTitles.js";
import type * as mutations_savePaymentMethod from "../mutations/savePaymentMethod.js";
import type * as mutations_scores_submitScore from "../mutations/scores/submitScore.js";
import type * as mutations_seed from "../mutations/seed.js";
import type * as mutations_setAutoRenew from "../mutations/setAutoRenew.js";
import type * as mutations_setGameCoverUrl from "../mutations/setGameCoverUrl.js";
import type * as mutations_setGameDetails from "../mutations/setGameDetails.js";
import type * as mutations_setGameTrailerUrl from "../mutations/setGameTrailerUrl.js";
import type * as mutations_simulateRental from "../mutations/simulateRental.js";
import type * as mutations_sweepExpirations from "../mutations/sweepExpirations.js";
import type * as mutations_toggleFavorite from "../mutations/toggleFavorite.js";
import type * as mutations_updateGame from "../mutations/updateGame.js";
import type * as mutations_updateUser from "../mutations/updateUser.js";
import type * as mutations_upgradePlan from "../mutations/upgradePlan.js";
import type * as mutations_upsertGameEmbed from "../mutations/upsertGameEmbed.js";
import type * as mutations_upsertUpcoming from "../mutations/upsertUpcoming.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as pushTokens from "../pushTokens.js";
import type * as queries_admin_listGames from "../queries/admin/listGames.js";
import type * as queries_admin_listProfiles from "../queries/admin/listProfiles.js";
import type * as queries_canPlayGame from "../queries/canPlayGame.js";
import type * as queries_cart from "../queries/cart.js";
import type * as queries_countFavorites from "../queries/countFavorites.js";
import type * as queries_games_getIdByEmbedUrl from "../queries/games/getIdByEmbedUrl.js";
import type * as queries_getAdmins from "../queries/getAdmins.js";
import type * as queries_getAllUsers from "../queries/getAllUsers.js";
import type * as queries_getAuditLogs from "../queries/getAuditLogs.js";
import type * as queries_getAvailableGames from "../queries/getAvailableGames.js";
import type * as queries_getFavoritesByUser from "../queries/getFavoritesByUser.js";
import type * as queries_getFeaturedByTitles from "../queries/getFeaturedByTitles.js";
import type * as queries_getFreeGames from "../queries/getFreeGames.js";
import type * as queries_getGameById from "../queries/getGameById.js";
import type * as queries_getGames from "../queries/getGames.js";
import type * as queries_getGamesByIds from "../queries/getGamesByIds.js";
import type * as queries_getPaymentMethods from "../queries/getPaymentMethods.js";
import type * as queries_getPremiumGames from "../queries/getPremiumGames.js";
import type * as queries_getUpcomingGames from "../queries/getUpcomingGames.js";
import type * as queries_getUserByEmail from "../queries/getUserByEmail.js";
import type * as queries_getUserById from "../queries/getUserById.js";
import type * as queries_getUserLibrary from "../queries/getUserLibrary.js";
import type * as queries_getUserPayments from "../queries/getUserPayments.js";
import type * as queries_getUserPurchases from "../queries/getUserPurchases.js";
import type * as queries_getUserRentals from "../queries/getUserRentals.js";
import type * as queries_getUserUpgrades from "../queries/getUserUpgrades.js";
import type * as queries_isFavorite from "../queries/isFavorite.js";
import type * as queries_listFavoritesByUser from "../queries/listFavoritesByUser.js";
import type * as queries_listGamesMinimal from "../queries/listGamesMinimal.js";
import type * as queries_listGamesWithoutCover from "../queries/listGamesWithoutCover.js";
import type * as queries_listGamesWithoutDetails from "../queries/listGamesWithoutDetails.js";
import type * as queries_listGamesWithoutTrailer from "../queries/listGamesWithoutTrailer.js";
import type * as queries_passwordReset from "../queries/passwordReset.js";
import type * as queries_scores_getMyBestByGame from "../queries/scores/getMyBestByGame.js";
import type * as queries_scores_topByGame from "../queries/scores/topByGame.js";
import type * as queries_searchGames from "../queries/searchGames.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/ageRatingsNuke": typeof actions_ageRatingsNuke;
  "actions/backfillCoversFromIGDB": typeof actions_backfillCoversFromIGDB;
  "actions/backfillDetailsFromIGDB": typeof actions_backfillDetailsFromIGDB;
  "actions/cleanupNotRated": typeof actions_cleanupNotRated;
  "actions/contact": typeof actions_contact;
  "actions/debugRawgSearch": typeof actions_debugRawgSearch;
  "actions/debugSearchIgdb": typeof actions_debugSearchIgdb;
  "actions/devPlanRemindersNow": typeof actions_devPlanRemindersNow;
  "actions/devSweepNow": typeof actions_devSweepNow;
  "actions/email": typeof actions_email;
  "actions/fillUpcomingCoversFromIGDB": typeof actions_fillUpcomingCoversFromIGDB;
  "actions/getIGDBScreenshots": typeof actions_getIGDBScreenshots;
  "actions/massBackfillAgeRatings": typeof actions_massBackfillAgeRatings;
  "actions/notifications/scheduleRentalExpiryReminders": typeof actions_notifications_scheduleRentalExpiryReminders;
  "actions/passwordReset": typeof actions_passwordReset;
  "actions/pushy": typeof actions_pushy;
  "actions/refreshIGDBBatch": typeof actions_refreshIGDBBatch;
  "actions/refreshIGDBRatingForGame": typeof actions_refreshIGDBRatingForGame;
  "actions/refreshRAWGBatch": typeof actions_refreshRAWGBatch;
  "actions/refreshRAWGRatingForGame": typeof actions_refreshRAWGRatingForGame;
  "actions/translateExistingDescriptions": typeof actions_translateExistingDescriptions;
  ads: typeof ads;
  auth: typeof auth;
  crons: typeof crons;
  games: typeof games;
  "lib/avatars": typeof lib_avatars;
  "lib/diffGame": typeof lib_diffGame;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/gameCore": typeof lib_gameCore;
  "lib/hash": typeof lib_hash;
  "lib/igdb/ageRatings": typeof lib_igdb_ageRatings;
  "lib/igdb/auth": typeof lib_igdb_auth;
  "lib/igdb/client": typeof lib_igdb_client;
  "lib/igdb/token": typeof lib_igdb_token;
  "lib/notifyTargets": typeof lib_notifyTargets;
  "lib/pricing": typeof lib_pricing;
  "lib/rawg/age": typeof lib_rawg_age;
  "lib/rawg/client": typeof lib_rawg_client;
  "mutations/addFavorite": typeof mutations_addFavorite;
  "mutations/addGame": typeof mutations_addGame;
  "mutations/addGamesBatch": typeof mutations_addGamesBatch;
  "mutations/admin/createGame": typeof mutations_admin_createGame;
  "mutations/admin/deleteGame": typeof mutations_admin_deleteGame;
  "mutations/admin/updateGame": typeof mutations_admin_updateGame;
  "mutations/admin/updateProfile": typeof mutations_admin_updateProfile;
  "mutations/applyAgeRating": typeof mutations_applyAgeRating;
  "mutations/applyIgdbRating": typeof mutations_applyIgdbRating;
  "mutations/authLogin": typeof mutations_authLogin;
  "mutations/cancelPremiumPlan": typeof mutations_cancelPremiumPlan;
  "mutations/cart": typeof mutations_cart;
  "mutations/completeTrialCharge": typeof mutations_completeTrialCharge;
  "mutations/contact": typeof mutations_contact;
  "mutations/createGame": typeof mutations_createGame;
  "mutations/createUser": typeof mutations_createUser;
  "mutations/deleteGame": typeof mutations_deleteGame;
  "mutations/deletePaymentMethod": typeof mutations_deletePaymentMethod;
  "mutations/deleteUser": typeof mutations_deleteUser;
  "mutations/devSetSubscriptionEndNow": typeof mutations_devSetSubscriptionEndNow;
  "mutations/emitPlanRenewed": typeof mutations_emitPlanRenewed;
  "mutations/ensurePlanConsistency": typeof mutations_ensurePlanConsistency;
  "mutations/makePayment": typeof mutations_makePayment;
  "mutations/preExpiryReminders": typeof mutations_preExpiryReminders;
  "mutations/promoteToAdmin": typeof mutations_promoteToAdmin;
  "mutations/removeFavorite": typeof mutations_removeFavorite;
  "mutations/rentGame": typeof mutations_rentGame;
  "mutations/restoreGameTitles": typeof mutations_restoreGameTitles;
  "mutations/savePaymentMethod": typeof mutations_savePaymentMethod;
  "mutations/scores/submitScore": typeof mutations_scores_submitScore;
  "mutations/seed": typeof mutations_seed;
  "mutations/setAutoRenew": typeof mutations_setAutoRenew;
  "mutations/setGameCoverUrl": typeof mutations_setGameCoverUrl;
  "mutations/setGameDetails": typeof mutations_setGameDetails;
  "mutations/setGameTrailerUrl": typeof mutations_setGameTrailerUrl;
  "mutations/simulateRental": typeof mutations_simulateRental;
  "mutations/sweepExpirations": typeof mutations_sweepExpirations;
  "mutations/toggleFavorite": typeof mutations_toggleFavorite;
  "mutations/updateGame": typeof mutations_updateGame;
  "mutations/updateUser": typeof mutations_updateUser;
  "mutations/upgradePlan": typeof mutations_upgradePlan;
  "mutations/upsertGameEmbed": typeof mutations_upsertGameEmbed;
  "mutations/upsertUpcoming": typeof mutations_upsertUpcoming;
  notifications: typeof notifications;
  profiles: typeof profiles;
  pushTokens: typeof pushTokens;
  "queries/admin/listGames": typeof queries_admin_listGames;
  "queries/admin/listProfiles": typeof queries_admin_listProfiles;
  "queries/canPlayGame": typeof queries_canPlayGame;
  "queries/cart": typeof queries_cart;
  "queries/countFavorites": typeof queries_countFavorites;
  "queries/games/getIdByEmbedUrl": typeof queries_games_getIdByEmbedUrl;
  "queries/getAdmins": typeof queries_getAdmins;
  "queries/getAllUsers": typeof queries_getAllUsers;
  "queries/getAuditLogs": typeof queries_getAuditLogs;
  "queries/getAvailableGames": typeof queries_getAvailableGames;
  "queries/getFavoritesByUser": typeof queries_getFavoritesByUser;
  "queries/getFeaturedByTitles": typeof queries_getFeaturedByTitles;
  "queries/getFreeGames": typeof queries_getFreeGames;
  "queries/getGameById": typeof queries_getGameById;
  "queries/getGames": typeof queries_getGames;
  "queries/getGamesByIds": typeof queries_getGamesByIds;
  "queries/getPaymentMethods": typeof queries_getPaymentMethods;
  "queries/getPremiumGames": typeof queries_getPremiumGames;
  "queries/getUpcomingGames": typeof queries_getUpcomingGames;
  "queries/getUserByEmail": typeof queries_getUserByEmail;
  "queries/getUserById": typeof queries_getUserById;
  "queries/getUserLibrary": typeof queries_getUserLibrary;
  "queries/getUserPayments": typeof queries_getUserPayments;
  "queries/getUserPurchases": typeof queries_getUserPurchases;
  "queries/getUserRentals": typeof queries_getUserRentals;
  "queries/getUserUpgrades": typeof queries_getUserUpgrades;
  "queries/isFavorite": typeof queries_isFavorite;
  "queries/listFavoritesByUser": typeof queries_listFavoritesByUser;
  "queries/listGamesMinimal": typeof queries_listGamesMinimal;
  "queries/listGamesWithoutCover": typeof queries_listGamesWithoutCover;
  "queries/listGamesWithoutDetails": typeof queries_listGamesWithoutDetails;
  "queries/listGamesWithoutTrailer": typeof queries_listGamesWithoutTrailer;
  "queries/passwordReset": typeof queries_passwordReset;
  "queries/scores/getMyBestByGame": typeof queries_scores_getMyBestByGame;
  "queries/scores/topByGame": typeof queries_scores_topByGame;
  "queries/searchGames": typeof queries_searchGames;
  transactions: typeof transactions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
