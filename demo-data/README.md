# JDS Event Platform Demo Dataset

This folder contains the official permanent demonstration dataset for the JDS Event Platform.

## Event Overview

Event: Harvest County Fair 2026

Harvest County Fair 2026 is a four-day agricultural fair designed for platform demos, local development, regression testing, import testing, attendee browsing, search and filter testing, itinerary workflows, and admin editing workflows.

The dataset includes realistic fair venues, booth areas, categories, schedule descriptions, vendor descriptions, operating hours, and operating days. Names are intentionally specific and production-like so the dataset can be used for screenshots, demos, QA, and future module development.

## Files

- `schedule.csv`: 60 schedule records.
- `vendors.csv`: 80 vendor records.

## Import Order

1. Import `schedule.csv`.
2. Import `vendors.csv`.

Schedule should be imported first because attendee itinerary behavior and event browsing workflows depend on schedule content.

## Expected Record Counts

- Schedule: 60 records.
- Vendors: 80 records.

## Format Notes

`schedule.csv` uses the current backend-compatible schedule CSV headers:

- `Name`
- `Start Date`
- `Event Start`
- `Event End`
- `Category`
- `Days_Active`
- `Description`
- `Location`
- `Lat`
- `Long`

The current schedule importer requires `Name`, `Start Date`, `Event Start`, and `Event End`.

`vendors.csv` uses the current vendor CSV headers:

- `Name`
- `Type`
- `Location`
- `Hours of Operation`
- `Days of Operation`
- `priority`
- `Description`

The current runtime vendor parser reads the first six fields. `Description` is included for demo completeness and future admin/vendor detail workflows.
