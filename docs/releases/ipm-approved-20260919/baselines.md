# Verified baselines — 2026-09-19

| Baseline | Exact SHA / deployment |
|---|---|
| origin/main, candidate parent | `5c41f907821cf11be9c3140d8b8c275c0f9b5c29` |
| origin/staging, frozen Build 376616 | `d7575f6d4eb8a9dd4730b317c182e0f91450f670` |
| PR #39 head | `bfa5d76342b446c16f06bacec1f6f1853cc85e33` |
| Live production frontend (Netlify published deployment) | `c43f8285c79b6e85acd61e89dfc224d9d55a53bf`, deploy `6aac66af96885a000742f71b` |
| Live production backend (read-only reconciliation-health build_commit) | `6aa820fd82129fc3913e488b23951da2ca8db031` |
| Frozen staging frontend deployment | `6aae8661c1b53c0008af9498` |

The live backend commit is an ancestor of main. Its backend difference to main is only the ID-preserving daily Schedule content script/manifest, both retained. GitHub also reports a Railway deployment at main, which is not the active frontend's Render backend; it was not used as runtime proof. The exact staging backend runtime SHA was not available through the unconfirmed Render workspace connector.

Production frontend site: `c64b53c9-5b39-441c-910a-dc00db77b4a5` / theipm.ca. Frozen staging site: `0932cc5d-9cb8-4cd3-8418-7e486df75bf1`.

## Open PRs observed before construction

No PR was merged or modified. These heads were inventoried, not imported wholesale.

| PR | Base | Head | SHA |
|---|---|---|---|
| [#39](https://github.com/mjacquot82-svg/ipm-event/pull/39) | `main` | `feature/itinerary-t30-reminders-production-candidate-20260918` | `bfa5d76342b446c16f06bacec1f6f1853cc85e33` |
| [#24](https://github.com/mjacquot82-svg/ipm-event/pull/24) | `staging` | `ui/accessibility-home-20260916` | `c823893e8c7c04a4740a50495c80679b4345fbb7` |
| [#23](https://github.com/mjacquot82-svg/ipm-event/pull/23) | `staging` | `chore/workspace-storage-staging-20260916` | `b12b0fb7b002cdb7b1f45226cd00260883276ccc` |
| [#22](https://github.com/mjacquot82-svg/ipm-event/pull/22) | `staging` | `content/dirtworks-schedule-20260915` | `28c0b0bfd4be67b9a9722ae7af0fb03390ae26be` |
| [#21](https://github.com/mjacquot82-svg/ipm-event/pull/21) | `staging` | `content/nicole-schneider-lifestyles-20260915` | `8b0920346c1d305ae8b77fefdfe0c1f51f116b06` |
| [#20](https://github.com/mjacquot82-svg/ipm-event/pull/20) | `staging` | `fix/grounds-no-entry-staging-20260915` | `80d85774730ac00c62ac20bdbd9999398f665401` |
| [#19](https://github.com/mjacquot82-svg/ipm-event/pull/19) | `release/live-production-base-20260912` | `promote/live-map-candidate-20260912` | `fe40a994e5e851851f9c919ae7002cba4ea90bd0` |
| [#18](https://github.com/mjacquot82-svg/ipm-event/pull/18) | `main` | `promote/production-map-candidate-20260912` | `42c2844849f7169e6829296f8978c89dd25f0036` |
| [#14](https://github.com/mjacquot82-svg/ipm-event/pull/14) | `staging` | `fix/pwa-resume-update-20260912` | `bd42d605119544016388e4b99f908c0f432d97c7` |
| [#13](https://github.com/mjacquot82-svg/ipm-event/pull/13) | `staging` | `fix/staging-fom-geometry-search-ux-20260912` | `ab62d299a992f3f49bee6cb72e0fe1ab36b6e8c2` |
| [#12](https://github.com/mjacquot82-svg/ipm-event/pull/12) | `staging` | `fix/staging-grounds-panzoom-geometry-20260912` | `5513ccabef997829b58c3ea65485c1417a16439d` |
| [#11](https://github.com/mjacquot82-svg/ipm-event/pull/11) | `staging` | `fix/staging-grounds-fom-highconf-20260912` | `c9e2fe6062715c66bf9036c4eacce948169969aa` |
| [#10](https://github.com/mjacquot82-svg/ipm-event/pull/10) | `fix/staging-show-guide-schedule-20260911` | `fix/staging-mnp-stage-parent-fallback-20260912` | `25cb521156194e5afb420e679c63bd9bc079f603` |
| [#3](https://github.com/mjacquot82-svg/ipm-event/pull/3) | `staging` | `add-tented-city-map` | `0a4801f7ea9a28f02f31516e9bf51c7a37f6da4d` |
| [#2](https://github.com/mjacquot82-svg/ipm-event/pull/2) | `main` | `integration/ipm-production-hardening` | `fe3343c7e4eb26c482cee797cdefcaa51af51cd1` |
| [#1](https://github.com/mjacquot82-svg/ipm-event/pull/1) | `main` | `conflict_300326_1956` | `0f651f9adb4523085364c572d87dd676d0349a09` |
