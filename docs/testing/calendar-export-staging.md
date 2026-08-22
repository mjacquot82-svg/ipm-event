# Calendar export staging device checklist

Record the device, OS/browser version, installed/PWA mode, selected calendar app, and outcome for every run. Do not mark mobile compatibility complete until physical-device testing passes.

Use these cases on every platform:

- A normal event with an authoritative start and end time.
- A Parade Week event with a start time and no end time.
- A multi-event itinerary containing both kinds of event.
- Cancel the share sheet and confirm no success message appears.
- Export the same event and itinerary twice and record whether the calendar app ignores, updates, or duplicates them.
- Confirm starring or unstarring alone never opens or downloads a calendar file.
- Confirm the imported title, date, time, location, and description exactly match Schedule.
- Confirm the calendar app, not IPM or WonderPush, controls reminders.

## Android Chrome browser

- Open staging Schedule in Chrome and export both single-event cases.
- Verify a supported native share sheet is used; otherwise verify the file download fallback.
- Import/open each file in at least one installed calendar app.
- Export a mixed multi-event itinerary and count all imported events.

## Installed Android PWA

- Repeat the Android Chrome cases from the installed PWA.
- Confirm the action remains user-initiated and returns safely after share cancellation.

## iPhone Safari

- Open staging Schedule in Safari and export both single-event cases.
- Record whether iOS shares, previews, downloads, or opens the calendar file.
- Complete the import in Apple Calendar where offered.
- Export and inspect a mixed multi-event itinerary.

## Installed iPhone PWA

- Repeat the iPhone Safari cases from the Home Screen installation where available.
- Verify cancellation and returning to the PWA do not display false success.

## Desktop Chrome

- Download single-event and multi-event files.
- Confirm filenames and that repeated clicks produce files without changing Starred state.

## Desktop calendar import

- Import into at least one of Apple Calendar, Outlook, or Google Calendar desktop.
- Verify exact content, UTC/Toronto instant conversion, zero-duration/start-only Parade behavior, and repeat-import behavior.
