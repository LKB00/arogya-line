# Device art

`pixel-8-back.webp` and `pixel-8-mask.webp` are Google's Pixel 8 device art,
the frames Android Studio draws around the emulator. Source: the Android Open
Source Project, `platform/tools/adt/idea`,
`artwork/resources/device-art-resources/pixel_8/` (`back.webp`, `mask.webp`),
Apache License 2.0. Unmodified, only renamed.

The screen in the art is 1080 × 2400 px at (49, 55) in a 1187 × 2513 image;
the prototype draws it at a third of that size, so the screen is 360 × 800.

## Status bar

The status bar inside the frame uses Android's own glyphs and sizes, not ones
drawn for this demo. Source: the Android Open Source Project,
`platform/frameworks/base` (main), Apache License 2.0:

- Wi-Fi: `core/res/res/drawable/ic_wifi_signal_4.xml`
- Signal: `core/res/res/drawable/ic_signal_cellular_4_4_bar.xml`
- Battery: `config_batterymeterPerimeterPath` and `config_batterymeterFillMask`
  in `core/res/res/values/config.xml`, the empty part at the meter's 30% alpha
- Sizes: `packages/SystemUI/res/values/dimens.xml` (clock 14sp, Wi-Fi and
  signal 15sp, battery 7.8 × 13sp, 6dp between the signal cluster and battery)
- Clock face: Roboto Medium (`sans-serif-medium`), self-hosted via
  `@fontsource/roboto`
