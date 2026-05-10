import './style.css'
import jsyaml from 'js-yaml' // Import the library we installed

// DOM Elements
const DOM = {
  rowsContainer: document.getElementById('rows-container'),
  otherPropContainer: document.getElementById('other-property-container'),
  form: document.getElementById('layout-form'),
  yamlOutput: document.getElementById('yaml-output'),
  downloadBtn: document.getElementById('download-btn'),
  importInput: document.getElementById('import-yaml-file'),
  importModal: document.getElementById('import-modal'),
  modalSummary: document.getElementById('modal-summary'),
  modalWarnings: document.getElementById('modal-warnings'),
  modalProceed: document.getElementById('modal-proceed'),
  modalCancel: document.getElementById('modal-cancel')
};

// special prefixes that prevent unicode substitution
const SPECIAL_PREFIXES = new Set(['$', '!']);
let letterRowCount = 0;

// --- Utility & Validation Helpers ---
// Convert a single string to UTF-16 \uXXXX escapes.
// For code points > 0xFFFF produces a surrogate pair as two \uXXXX sequences.
function toUtf16Escaped(str) {
  if (str == null) return '';
  let out = '';
  for (let i = 0; i < str.length; ) {
    const cp = str.codePointAt(i);
    i += cp > 0xFFFF ? 2 : 1;
    if (cp <= 0xFFFF) {
      out += '\\u' + cp.toString(16).padStart(4, '0');
    } else {
      const v = cp - 0x10000;
      const high = 0xD800 + (v >> 10);
      const low = 0xDC00 + (v & 0x3FF);
      out += '\\u' + high.toString(16).padStart(4, '0') + '\\u' + low.toString(16).padStart(4, '0');
    }
  }
  return out;
}

// Decide whether to apply UTF-16 substitution for a given key string.
// - If the value is a string and length > 1 and starts with any SPECIAL_PREFIXES, DO NOT convert.
// - Otherwise, convert (when substitution is requested).
function shouldConvertKeyValue(val) {
  if (typeof val !== 'string') return true; // non-strings (e.g., objects) keep conversion behavior as-is
  if (val.length > 1 && SPECIAL_PREFIXES.has(val[0])) return false;
  return true;
}

// Returns an array of warning strings if
// 1) more-keys without corresponding base/shifted
// 2) any non-base field populated while base is empty
function collectWarnings(root = document) {
  const warns = [];
  root.querySelectorAll('.key-field').forEach((f, idx) => {
    const base = (f.querySelector('.base')?.value || '').trim();
    const shifted = (f.querySelector('.shifted')?.value || '').trim();
    const moreB = (f.querySelector('.more-base')?.value || '').trim();
    const moreS = (f.querySelector('.more-shifted')?.value || '').trim();

    if (!base && (shifted || moreB || moreS)) warns.push(`Key #${idx+1}: base key is empty but other fields are filled.`);
    if (moreB && !base) warns.push(`Key #${idx+1}: "more-keys for base" set but base is empty.`);
    if (moreS && !shifted) warns.push(`Key #${idx+1}: "more-keys for shifted" set but shifted key is empty.`);
  });
  return warns;
}

function renumberLetterRows(container = DOM.rowsContainer) {
  let idx = 0;
  container.querySelectorAll('[data-type="letters"]').forEach(fs => {
    idx++;
    const span = fs.querySelector('.row-title');
    if (span) span.textContent = `${idx} - LETTERS ROW`;
  });
  // Only update global state if we are modifying the real DOM
  if (container === DOM.rowsContainer) letterRowCount = idx;
}

// --- Factory Functions (DOM Builders utilizing Templates) ---
function addKeyField(container, data = null) {
  if (container.children.length >= 12) return false;
  
  const tmpl = document.getElementById('tmpl-key-field');
  const wrapper = tmpl.content.cloneNode(true).firstElementChild;
  
  const inputs = {
    base: wrapper.querySelector('.base'),
    shifted: wrapper.querySelector('.shifted'),
    moreBase: wrapper.querySelector('.more-base'),
    moreShifted: wrapper.querySelector('.more-shifted')
  };

  if (data) {
    if (typeof data === 'string') {
      inputs.base.value = data;
    } else if (Array.isArray(data)) {
      inputs.base.value = data[0] ?? '';
      inputs.moreBase.value = data.slice(1).join(', ');
    } else if (typeof data === 'object' && data.type === 'case') {
      const { normal, shifted } = data;
      if (Array.isArray(normal)) {
        inputs.base.value = normal[0] ?? '';
        inputs.moreBase.value = normal.slice(1).join(', ');
      } else if (typeof normal === 'string') {
        inputs.base.value = normal;
      }
      if (Array.isArray(shifted)) {
        inputs.shifted.value = shifted[0] ?? '';
        inputs.moreShifted.value = shifted.slice(1).join(', ');
      } else if (typeof shifted === 'string') {
        inputs.shifted.value = shifted;
      }
    }
  }

  wrapper.querySelector('.remove-key').addEventListener('click', () => wrapper.remove());
  container.appendChild(wrapper);
  return true;
}

function createRow(type, automatic = false) {
  const tmpl = document.getElementById('tmpl-row');
  const row = tmpl.content.cloneNode(true).firstElementChild;
  
  row.dataset.type = type;
  row.querySelector('.row-title').textContent = `${type.toUpperCase()} ROW`;
  
  const keysContainer = row.querySelector('.keys-container');

  row.querySelector('.remove-row').addEventListener('click', () => {
    row.remove();
    if (type === 'letters') renumberLetterRows();
  });
  
  row.querySelector('.add-key').addEventListener('click', () => addKeyField(keysContainer));

  if (!automatic) {
    addKeyField(keysContainer);
  }
  
  return row;
}

function addOtherProperty(name = '', value = '') {
  const tmpl = document.getElementById('tmpl-other-property');
  const wrapper = tmpl.content.cloneNode(true).firstElementChild;
  
  wrapper.querySelector('.other-attr-name').value = name;
  const valueArea = wrapper.querySelector('.other-attr-value');

  if (value !== undefined && value !== '') {
    try {
      valueArea.value = (typeof jsyaml !== 'undefined' && jsyaml.dump)
        ? jsyaml.dump(value).trim()
        : JSON.stringify(value, null, 2);
    } catch (e) {
      valueArea.value = String(value);
    }
  }

  wrapper.querySelector('.remove-attr').addEventListener('click', () => wrapper.remove());
  DOM.otherPropContainer.appendChild(wrapper);
  return wrapper;
}

// --- Serialization / Submit Flow ---
// Parse a textual property value into a JS value.
// Tries: jsyaml.load -> JSON.parse -> raw string
function parsePropertyValue(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return undefined;
  try {
    if (typeof jsyaml !== 'undefined' && jsyaml.load) return jsyaml.load(trimmed);
  } catch (e) {}
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return trimmed;
  }
}

function collectOtherProperties() {
  const out = {};
  DOM.otherPropContainer.querySelectorAll('.other-property-item').forEach(item => {
    const key = (item.querySelector('.other-attr-name')?.value || '').trim();
    if (!key) return;
    const parsed = parsePropertyValue(item.querySelector('.other-attr-value')?.value || '');
    out[key] = parsed === undefined ? '' : parsed;
  });
  return out;
}

function renderOtherPropertiesFromObject(obj) {
  DOM.otherPropContainer.innerHTML = '';
  const allowed = new Set(['name', 'description', 'languages', 'rows']);
  Object.keys(obj || {}).forEach((key) => {
    if (!allowed.has(key)) addOtherProperty(key, obj[key]);
  });
}

DOM.form.addEventListener('submit', e => {
  e.preventDefault();
  
  const problems = collectWarnings();
  if (problems.length) {
    alert("Please fix the following:\n" + problems.join("\n"));
    return;
  }

  const shouldSubstitute = document.getElementById('substitute-with-unicode-16')?.checked || false;

  const out = {
    name: document.getElementById('layout-name').value.trim(),
    description: document.getElementById('layout-desc').value.trim() || undefined,
    languages: document.getElementById('lang-code').value.trim(),
    rows: []
  };

  if (!out.description) delete out.description;

  for (const fs of DOM.rowsContainer.children) {
    const type = fs.dataset.type;
    const keysArr = [];

    fs.querySelectorAll('.key-field').forEach(f => {
      const rawBase = f.querySelector('.base').value.trim();
      if (!rawBase) return;
      const rawShifted = f.querySelector('.shifted').value.trim();
      const rawMoreB = f.querySelector('.more-base').value.split(/\s*,\s*/).filter(Boolean);
      const rawMoreS = f.querySelector('.more-shifted').value.split(/\s*,\s*/).filter(Boolean);

      const base = (shouldSubstitute && shouldConvertKeyValue(rawBase)) ? toUtf16Escaped(rawBase) : rawBase;
      const shifted = rawShifted 
          ? ((shouldSubstitute && shouldConvertKeyValue(rawShifted)) ? toUtf16Escaped(rawShifted) : rawShifted) 
          : rawShifted;
          
      const moreB = shouldSubstitute ? rawMoreB.map(x => shouldConvertKeyValue(x) ? toUtf16Escaped(x) : x) : rawMoreB;
      const moreS = shouldSubstitute ? rawMoreS.map(x => shouldConvertKeyValue(x) ? toUtf16Escaped(x) : x) : rawMoreS;

      if (shifted) {
        keysArr.push({
          type: 'case',
          normal: moreB.length ?[base, ...moreB] : base,
          shifted: moreS.length ? [shifted, ...moreS] : shifted
        });
      } else if (moreB.length) {
        keysArr.push([base, ...moreB]);
      } else {
        keysArr.push(base);
      }
    });
    out.rows.push({ [type]: keysArr });
  }

  const otherProps = collectOtherProperties();
  for (const k in otherProps) {
    if (!['name', 'description', 'languages', 'rows'].includes(k)) out[k] = otherProps[k];
  }

  const yamlStr = jsyaml.dump(out, { lineWidth: 80 });
  DOM.yamlOutput.textContent = yamlStr;

  DOM.downloadBtn.disabled = false;
  DOM.downloadBtn.onclick = () => {
    const blob = new Blob([yamlStr], { type: 'text/yaml;charset=utf-8' });
    const name = out.name || 'layout';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/\s+/g, '_') + '.yaml';
    a.click();
    URL.revokeObjectURL(a.href);
  };
});

// --- Initialization & Button Binding ---

document.getElementById('preview-btn').onclick = () => DOM.form.requestSubmit(); // scroll to generated yaml and enable apt tab

document.getElementById('add-numbers-row').onclick = () => {
  if (!DOM.rowsContainer.querySelector('[data-type="numbers"]')) DOM.rowsContainer.prepend(createRow('numbers'));
};

document.getElementById('add-letters-row').onclick = () => {
  if (letterRowCount < 8) {
    const newRow = createRow('letters');
    const bottomRow = DOM.rowsContainer.querySelector('[data-type="bottom"]');
    bottomRow ? DOM.rowsContainer.insertBefore(newRow, bottomRow) : DOM.rowsContainer.appendChild(newRow);
    renumberLetterRows();
  }
};

document.getElementById('add-bottom-row').onclick = () => {
  if (!DOM.rowsContainer.querySelector('[data-type="bottom"]')) DOM.rowsContainer.appendChild(createRow('bottom'));
};

document.getElementById('add-other-property-item').onclick = () => addOtherProperty();

// --- Import Flow Logic ---

async function importYamlFileWithPreview(file) {
  try {
    const txt = await file.text();
    const obj = jsyaml.load(txt);
    if (!obj || typeof obj !== 'object') throw new Error('YAML did not parse to a valid object.');

    const rowDefs = Array.isArray(obj.rows) ? obj.rows : [];
    const { fragment, summary, warnings } = buildPreviewFragment(rowDefs);

    showImportModal({ summary, warnings }, () => {
      // Apply Metadata
      if (typeof obj.name === 'string') document.getElementById('layout-name').value = obj.name;
      if (typeof obj.description === 'string') document.getElementById('layout-desc').value = obj.description;
      if (typeof obj.languages === 'string') document.getElementById('lang-code').value = obj.languages;
      
      // Render rows and properties
      DOM.rowsContainer.innerHTML = '';
      DOM.rowsContainer.appendChild(fragment);
      renumberLetterRows();
      renderOtherPropertiesFromObject(obj);

      const finalWarnings = collectWarnings();
      if (finalWarnings.length) console.log('Import completed with warnings:\n' + finalWarnings.join('\n'));
      else console.log('Import completed successfully.');

      // Re-generate YAML so download state activates
      DOM.form.requestSubmit(); 
    });

  } catch (err) {
    console.error(err);
    alert('Failed to import YAML: ' + err.message);
  }
}

function buildPreviewFragment(parsedRows) {
  const fragment = document.createDocumentFragment();
  const summary = [], warnings = [];
  let letterCount = 0, sawNumbers = false, sawBottom = false;

  for (const r of parsedRows) {
    const keys = Object.keys(r);
    if (keys.length !== 1) {
      warnings.push('A row entry in YAML did not have exactly one key (skipped).');
      continue;
    }
    const type = keys[0];
    const keysArr = Array.isArray(r[type]) ? r[type] : [];

    if (type === 'numbers') {
      if (sawNumbers) { warnings.push('Duplicate numbers row ignored.'); continue; }
      sawNumbers = true;
    }
    if (type === 'bottom') {
      if (sawBottom) { warnings.push('Duplicate bottom row ignored.'); continue; }
      sawBottom = true;
    }
    if (type === 'letters') {
      letterCount++;
      if (letterCount > 8) { warnings.push('More than 8 letters rows ignored.'); break; }
    }

    const rowEl = createRow(type, true);
    const keysDiv = rowEl.querySelector('.keys-container');

    let added = 0;
    for (const kd of keysArr) {
      if (added >= 12) { warnings.push(`A ${type} row has >12 keys; extras truncated.`); break; }
      addKeyField(keysDiv, kd);
      added++;
    }

    fragment.appendChild(rowEl);
    summary.push({ type, keyCount: added });
  }

  renumberLetterRows(fragment); // Cleanly number the fragment before rendering warnings
  collectWarnings(fragment).forEach(pw => warnings.push('(preview) ' + pw));
  return { fragment, summary, warnings };
}

function showImportModal({ summary, warnings }, onProceed) {
  
  // Inject Summary HTML with Tailwind classes
  DOM.modalSummary.innerHTML = `
    <h4 class="font-semibold text-lg text-base-content mt-0">Summary</h4>
    <ul class="list-disc pl-5 text-base-content/80">
      ${summary.map(s => `<li><span class="uppercase font-medium">${s.type}</span> — ${s.keyCount} key(s)</li>`).join('')}
    </ul>
  `;
  
  // Inject Warnings HTML with Tailwind classes
  if (!warnings || warnings.length === 0) {
    DOM.modalWarnings.innerHTML = `
      <h4 class="font-semibold text-lg text-base-content mt-4">Issues / Warnings</h4>
      <p class="text-success font-medium">No warnings detected in preview. Good to go!</p>
    `;
  } else {
    DOM.modalWarnings.innerHTML = `
      <h4 class="font-semibold text-lg text-base-content mt-4">Issues / Warnings</h4>
      <ul class="list-disc pl-5 text-error">
        ${warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
    `;
  }

  // Clone buttons to clear out previous event listeners safely
  const newProceed = DOM.modalProceed.cloneNode(true);
  const newCancel = DOM.modalCancel.cloneNode(true);
  DOM.modalProceed.replaceWith(newProceed);
  DOM.modalCancel.replaceWith(newCancel);
  
  // update DOM references
  DOM.modalProceed = newProceed;
  DOM.modalCancel = newCancel;

  DOM.modalProceed.addEventListener('click', () => {
    DOM.importModal.close();
    onProceed();
  });

  DOM.modalCancel.addEventListener('click', () => {
    DOM.importModal.close();
  });

  // Native dialog show function from HTML5/DaisyUI
  DOM.importModal.showModal();
}

if (DOM.importInput) {
  DOM.importInput.addEventListener('change', ev => {
    const file = ev.target.files?.[0];
    if (!file) return;
    importYamlFileWithPreview(file);
    DOM.importInput.value = ''; // Reset input to allow re-importing the same file later
  });
}