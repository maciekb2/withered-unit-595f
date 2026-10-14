# October 14 release: sharp scan repair

The eight articles from October 7–14 merged in PR292 as a5b1165b3915859b242dd03a702f21853c1fbcf6. Mandatory native Trivy scanning blocked candidate sha256:20fdff5732f2ba758e4e85f88761cc0b811283a58d29cb3ad228e8c65490ce2f on one HIGH finding, GHSA-wq5f-xc86-pv6w, sharp0.35.4. No promotion occurred. Existing runtime remains db51339d / sha256:26112387359d334a783efe2802bac8c4d07844ded94c938e276fc1d8deecbbb4.

Update the existing sharp override to0.35.5 and refresh only sharp and its platform binary lock entries. All application content/assets remain identical. Primary advisory: https://github.com/advisories/GHSA-wq5f-xc86-pv6w; fixed release0.35.5 contains corrected librsvg dependency. Do not bypass the HIGH/CRITICAL image gate or substitute an informational npm audit result for it.

Acceptance: npm run check, five PR CI jobs, mandatory native build/scan/promotion, Flux immutable pin and matching five runtime image IDs. Then exact public acceptance for eight bodies/titles/sourceUrls, PNG hashes/dimensions, RSS all8, archive197, navigation/topics, health and responsive UI. No database migration, persistent storage, secret or scheduler change. Previous digest above remains rollback.
