# FUTO Keyboard Layout Builder

A simple web based graphical interface to help create keyboard layout for FUTO Keyboard

[Visit here](https://softorage.github.io/FUTO-Keyboard-Layout-Builder/)

## How to use

### Basic Information

* Name: Name of the keyboard layout
* Description: Description of the keyboard layout
* Language Code: Language code of the keyboard layout

### Rows

* Numbers Row: Row for numbers (1-9, 0). Can be 1 at max.
* Letters Row: Rows for letters. Can be 8 at max.
* Bottom Row: Row for bottom keys (e.g. space, symbols, enter). Can be 1 at max.

### Keys

A key is a combination of base key, shifted key, and more keys.

* Base Key: Key that is visible to the user.
* Shifted Key: Key that is visible to the user when shift is pressed.
* More Keys:
  * Key(s) that is/are visible to the user when the key is long-pressed.
  * Comma separated.
  * More Keys can be specified for both Base Key (visible on long-press) and Shifted Key (visible on long-press while Shift is pressed).

> There can be at max 12 keys in each row.

## Notes

### Template Keys

You can use below keys (called Template Keys) for various behaviours:
*  $shift - shift key
*  $delete - backspace key
*  $space - spacebar
*  $enter - enter/search/next/prev/go key
*  $symbols - switch to symbols menu
*  $alphabet - switch back to alphabet (only used in symbols layout)
*  $action - action key, user-defined, may be empty
*  $number - switch to numpad mode
*  $contextual - contextual key, / for URLs and date fields, @ for email fields, : for time fields
*  $zwnj - Zero-width non-joiner key, and zero-width joiner key in morekeys.
*  $optionalzwnj - same as $zwnj if useZWNJKey is true, else none
*  $gap - regular-width gap
*  $alt0 - switch to alt page 0, or back from alt page 0
*  $alt1 - switch to alt page 1, or back from alt page 1
*  $alt2 - switch to alt page 2, or back from alt page 2

### Keyboard Behaviour

Some of the FUTO Keyboard's behaviour notes:
* A default number row and bottom row will be added by the keyboard if they are not explicitly defined.
* The keyboard automatically prepends $shift and appends $delete to the final Letter Row. This can be overridden by:
  * Specifying $shift and/or $delete somewhere OR
  * Specifying an explicit bottom row

### LayoutSpec

For detailed instructions, follow the [ LayoutSpec documentation](https://github.com/futo-org/futo-keyboard-layouts/blob/main/LayoutSpec.md).

## License

Copyright 2025 Sanmay Joshi

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Sanmay Joshi and Softorage are not affiliated with FUTO or FUTO Keyboard. This tool is designed solely for assistance purposes. No warranties or guarantees are provided regarding the accuracy or reliability of the tool or any information. Use at your own risk.

[Apache License, Version 2.0](/LICENSE.txt)
