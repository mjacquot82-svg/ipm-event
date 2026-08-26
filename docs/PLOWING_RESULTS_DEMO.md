# Plowing Results demonstration (staging only)

This proof of concept uses synthetic competitors, towns, and scores. It is not an official results system and must not be enabled in production until IPM and the Ontario Plowmen's Association confirm the scoring, approval, and publication rules.

## Source boundary

The attendee experience consumes one normalized Plowing Results document. The current source is the manual IPM demonstration editor. A future importer can replace that source without rebuilding the attendee screens:

`Manual IPM editor | spreadsheet/CSV/Google Sheet | existing scoring system → normalized Plowing Results data → attendee presentation`

The staging API and Mongo collection are isolated as `ipm-plowing-results-demo-v1`, use event scope `ipm-2026-demo`, and do not read or write Schedule, Vendor, notification, or reminder data. Higher points rank first in the demo. Equal points sort alphabetically only for deterministic presentation; this is not an assertion about official tie-breaking.

## Meeting questions for IPM

- How are plowing scores/results entered today?
- Is a spreadsheet used?
- Who enters the results?
- How many Classes and Groups exist in 2026?
- What information is recorded for each competitor?
- Are daily results published?
- Are standings provisional before approval?
- Who approves results before public release?
- What determines final position?
- How are ties handled?
- Would they want live provisional results or approved results only?
- How quickly after scoring should results appear?
- Do they want overall/special award standings as well?

## Demonstration rehearsal

1. Sign in to the staging organizer dashboard and open **Plowing Results**.
2. Select **Class 5**, then **Group 1**.
3. Change one fictional competitor's points and choose **Publish Results**.
4. On a second device, open **Plowing Results**, select the same class/group, and pull to refresh or wait up to 15 seconds.
5. Confirm the competitor moves automatically and **Last updated** changes.
6. Return to the manager, choose **Reset Demo Results**, and confirm the reset.

Reset always restores the known synthetic presentation dataset and requires explicit confirmation.
