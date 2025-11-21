// script.js

document.addEventListener('DOMContentLoaded', () => {
  const rowsContainer = document.getElementById('rows-container');
  const form = document.getElementById('layout-form');
  let letterRowCount = 0;

  /**
   * Returns an array of warning strings.
   * Accepts an optional root element to run checks against a preview DOM.
   * 1) more-keys without corresponding base/shifted
   * 2) any non-base field populated while base is empty
   */
  function collectWarnings(root = document) {
    const warns = [];
    const keyFields = root.querySelectorAll('.key-field');
    keyFields.forEach((f, idx) => {
      const baseEl = f.querySelector('.base');
      const shiftedEl = f.querySelector('.shifted');
      const moreBEl = f.querySelector('.more-base');
      const moreSEl = f.querySelector('.more-shifted');

      const base = (baseEl && baseEl.value || '').trim();
      const shifted = (shiftedEl && shiftedEl.value || '').trim();
      const moreB = (moreBEl && moreBEl.value || '').trim();
      const moreS = (moreSEl && moreSEl.value || '').trim();

      if (!base && (shifted || moreB || moreS)) {
        warns.push(`Key #${idx+1}: base key is empty but other fields are filled.`);
      }
      if (moreB && !base) {
        warns.push(`Key #${idx+1}: "more-keys for base" set but base is empty.`);
      }
      if (moreS && !shifted) {
        warns.push(`Key #${idx+1}: "more-keys for shifted" set but shifted key is empty.`);
      }
    });
    return warns;
  }

  // Re-number existing letter rows and reset letterRowCount
  function renumberLetterRows() {
    let idx = 0;
    rowsContainer
      .querySelectorAll('[data-type="letters"]')
      .forEach(fs => {
        idx++;
        const span = fs.querySelector('legend span');
        if (span) span.textContent = `${idx} - LETTERS ROW`;
      });
    letterRowCount = idx;
  }

  // Create a new row (numbers, letters, or bottom)
  function createRow(type) {
    const fs = document.createElement('fieldset');
    fs.dataset.type = type;

    // legend with remove button
    const lg = document.createElement('legend');
    lg.innerHTML = `<span>${type.toUpperCase()} ROW</span>
                    <button type="button" class="remove-row pico-background-red-600">🗑</button>`;
    fs.appendChild(lg);
    lg.querySelector('.remove-row').onclick = () => {
      fs.remove();
      if (type === 'letters') renumberLetterRows();
    };

    // keys container and add-key button
    const keysDiv = document.createElement('div');
    keysDiv.className = 'keys-container';
    fs.appendChild(keysDiv);

    const addKeyBtn = document.createElement('button');
    addKeyBtn.type = 'button';
    addKeyBtn.classList.add('add-key');
    addKeyBtn.textContent = '+ Add Key';
    addKeyBtn.onclick = () => addKeyInput(keysDiv);
    fs.appendChild(addKeyBtn);

    return fs;
  }

  // Add one key input group (up to 12)
  function addKeyInput(container) {
    if (container.children.length >= 12) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'key-field';

    wrapper.innerHTML = `
      <label>Base Key
        <input class="base" placeholder="e.g. a" />
      </label>
      <label>Shifted Key
        <input class="shifted" placeholder="(optional) e.g. A" />
      </label>
      <label>More-keys for Base
        <input class="more-base" placeholder="(comma-separated)" />
      </label>
      <label>More-keys for Shifted
        <input class="more-shifted" placeholder="(comma-separated)" />
      </label>
      <button type="button" class="remove-key">Remove Key</button>
    `;
    wrapper.querySelector('.remove-key').onclick = () => wrapper.remove();
    container.appendChild(wrapper);
  }

  // Row-add buttons
  document.getElementById('add-numbers-row').onclick = () => {
    if (!rowsContainer.querySelector('[data-type="numbers"]')) {
      rowsContainer.prepend(createRow('numbers'));
    }
  };
  document.getElementById('add-letters-row').onclick = () => {
    if (letterRowCount < 8) {
      letterRowCount++;
      const newRow = createRow('letters');
      // prefix the legend’s span with its sequence number
      newRow.querySelector('legend span').textContent = `${letterRowCount} - LETTERS ROW`;
      // insert letters row before the bottom row
      const bottomRow = rowsContainer.querySelector('[data-type="bottom"]');
      if (bottomRow) {
        rowsContainer.insertBefore(newRow, bottomRow);
      } else {
        rowsContainer.appendChild(newRow);
      }
    }
  };
  document.getElementById('add-bottom-row').onclick = () => {
    if (!rowsContainer.querySelector('[data-type="bottom"]')) {
      rowsContainer.appendChild(createRow('bottom'));
    }
  };

  // Serialize on submit
  form.addEventListener('submit', e => {
    e.preventDefault();

    // 1) collect & show warnings
    const problems = collectWarnings();
    if (problems.length) {
      alert("Please fix the following:\n" + problems.join("\n"));
      return;
    }

    const out = {
      name:      document.getElementById('layout-name').value.trim(),
      description: document.getElementById('layout-desc').value.trim() || undefined,
      languages: document.getElementById('lang-code').value.trim(),
      rows:      []
    };

    for (const fs of rowsContainer.children) {
      const type = fs.dataset.type;
      const keysArr = [];

      fs.querySelectorAll('.key-field').forEach(f => {
        const base = f.querySelector('.base').value.trim();
        if (!base) return;
        const shifted = f.querySelector('.shifted').value.trim();
        const moreB = f.querySelector('.more-base').value
                          .split(/\s*,\s*/)
                          .filter(s=>s);
        const moreS = f.querySelector('.more-shifted').value
                          .split(/\s*,\s*/)
                          .filter(s=>s);

        // Decide structure
        if (shifted) {
          // case style
          const normalVal = moreB.length
            ? [base, ...moreB]
            : base;
          const shiftedVal = moreS.length
            ? [shifted, ...moreS]
            : shifted;

          const obj = { type: 'case' };
          obj.normal = normalVal;
          obj.shifted = shiftedVal;
          keysArr.push(obj);
        }
        else if (moreB.length) {
          // array of base + more-keys
          keysArr.push([base, ...moreB]);
        }
        else {
          // just the base string
          keysArr.push(base);
        }
      });

      out.rows.push({ [type]: keysArr });
    }

    // Remove undefined description if empty
    if (!out.description) delete out.description;

    // Merge other attributes from section#other-attribute-container
    const otherAttrs = collectOtherAttributes();
    for (const k in otherAttrs) {
      // don't overwrite standard keys
      if (['name','description','languages','rows'].includes(k)) continue;
      out[k] = otherAttrs[k];
    }

    // YAML dump
    const yamlStr = jsyaml.dump(out, { lineWidth: 80 });
    document.getElementById('yaml-output').textContent = yamlStr;

    // enable download button with current YAML
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
      const blob = new Blob([yamlStr], { type: 'text/yaml;charset=utf-8' });
      const name = document.getElementById('layout-name').value.trim() || 'layout';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name.replace(/\s+/g, '_') + '.yaml';
      a.click();
      URL.revokeObjectURL(a.href);
    };
  });
  // wire Preview button to trigger the form’s onsubmit handler
  document.getElementById('preview-btn').onclick = () => {
    form.requestSubmit();
  };

  // ------------------ Import + Preview functionality ------------------

  // file input element is assumed to exist in the page:
  // <input id="import-yaml-file" type="file" accept=".yml,.yaml,text/yaml" />
  const importInput = document.getElementById('import-yaml-file');

  // Read file helper
  async function readFileAsText(file) {
    if (file.text) return await file.text();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsText(file);
    });
  }

  function clearRowsContainer() {
    rowsContainer.innerHTML = '';
    letterRowCount = 0;
  }


  // ------------------ Other-attributes renderer helpers ------------------

  // Clear existing other-attribute UI
  function clearOtherAttributes() {
    const container = document.querySelector('section#other-attribute-container');
    if (!container) return;
    container.innerHTML = '';
  }

  // Parse a textual attribute value into a JS value.
  // Tries: jsyaml.load -> JSON.parse -> raw string
  function parseAttributeValue(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return undefined;
    try {
      if (typeof jsyaml !== 'undefined' && jsyaml.load) {
        return jsyaml.load(trimmed);
      }
    } catch (e) {
      // fallthrough to JSON
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // return raw string
      return trimmed;
    }
  }

  // Collect other attributes currently present in the UI into an object
  function collectOtherAttributes() {
    const out = {};
    const container = document.querySelector('section#other-attribute-container');
    if (!container) return out;

    const items = container.querySelectorAll('.other-attribute-item');
    items.forEach(item => {
      const nameInput = item.querySelector('.other-attr-name');
      const valueArea = item.querySelector('.other-attr-value');
      if (!nameInput) return;
      const key = (nameInput.value || '').trim();
      if (!key) return;
      const parsed = parseAttributeValue(valueArea ? valueArea.value : '');
      // only set if parsed is not undefined; otherwise set empty string
      out[key] = parsed === undefined ? '' : parsed;
    });
    return out;
  }

  // Render all top-level keys other than name/description/languages/rows
  // `obj` is the parsed YAML top-level object
  function renderOtherAttributesFromObject(obj) {
    const container = document.querySelector('section#other-attribute-container');
    if (!container) return;
    clearOtherAttributes();

    const allowed = new Set(['name', 'description', 'languages', 'rows']);
    Object.keys(obj || {}).forEach((key) => {
      if (allowed.has(key)) return;

      const val = obj[key];

      // Parent wrapper for styling / removal later if needed
      const wrapper = document.createElement('div');
      wrapper.className = 'other-attribute-item';
      wrapper.style.marginBottom = '0.5rem';
      wrapper.style.position = 'relative';

      // remove button (tiny)
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-attr';
      removeBtn.title = 'Remove attribute';
      removeBtn.textContent = '✖';
      Object.assign(removeBtn.style, {
        position: 'absolute',
        right: '4px',
        top: '4px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '0.9rem',
        padding: '2px'
      });
      removeBtn.onclick = () => wrapper.remove();

      // name input (prefilled)
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Attribute name';
      nameLabel.style.display = 'block';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'other-attr-name';
      nameInput.value = key;
      nameInput.style.width = '100%';
      nameInput.style.boxSizing = 'border-box';

      // value textarea (prefilled with YAML dump for readability)
      const valueLabel = document.createElement('label');
      valueLabel.textContent = 'Attribute value';
      valueLabel.style.display = 'block';
      const valueArea = document.createElement('textarea');
      valueArea.className = 'other-attr-value';
      // Use jsyaml.dump to render complex structures nicely; fallback to JSON if jsyaml not available
      try {
        valueArea.value = (typeof jsyaml !== 'undefined' && jsyaml.dump)
          ? jsyaml.dump(val).trim()
          : JSON.stringify(val, null, 2);
      } catch (e) {
        valueArea.value = String(val === undefined ? '' : val);
      }
      valueArea.rows = 4;
      valueArea.style.width = '100%';
      valueArea.style.boxSizing = 'border-box';

      // append everything
      nameLabel.appendChild(nameInput);
      valueLabel.appendChild(valueArea);
      wrapper.appendChild(removeBtn);
      wrapper.appendChild(nameLabel);
      wrapper.appendChild(valueLabel);
      container.appendChild(wrapper);
    });
  }

  // Create a single other-attribute item (used by import renderer and the "Add" button)
  function createOtherAttributeItem(name = '', value = '') {
    const container = document.querySelector('section#other-attribute-container');
    if (!container) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'other-attribute-item';
    wrapper.style.marginBottom = '0.5rem';
    wrapper.style.position = 'relative';

    // tiny remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-attr';
    removeBtn.title = 'Remove attribute';
    removeBtn.textContent = '✖';
    Object.assign(removeBtn.style, {
      position: 'absolute',
      right: '4px',
      top: '4px',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontSize: '0.9rem',
      padding: '2px'
    });
    removeBtn.onclick = () => wrapper.remove();

    // name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Attribute name';
    nameLabel.style.display = 'block';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'other-attr-name';
    nameInput.value = name || '';
    nameInput.style.width = '100%';
    nameInput.style.boxSizing = 'border-box';

    // value textarea
    const valueLabel = document.createElement('label');
    valueLabel.textContent = 'Attribute value';
    valueLabel.style.display = 'block';
    const valueArea = document.createElement('textarea');
    valueArea.className = 'other-attr-value';
    valueArea.rows = 4;
    valueArea.style.width = '100%';
    valueArea.style.boxSizing = 'border-box';
    valueArea.value = value;
    /* not needed for now hence commenting out ---
    value you pass (text, number, object, array, etc.) gets converted into readable text and safely placed into the textarea, using YAML if possible
    and falling back to JSON or plain string if not
    */
    /*
    if (value !== undefined) {
      try {
        valueArea.value = (typeof jsyaml !== 'undefined' && jsyaml.dump)
          ? jsyaml.dump(value).trim()
          : JSON.stringify(value, null, 2);
      } catch (e) {
        valueArea.value = String(value === undefined ? '' : value);
      }
    }
    */

    nameLabel.appendChild(nameInput);
    valueLabel.appendChild(valueArea);
    wrapper.appendChild(removeBtn);
    wrapper.appendChild(nameLabel);
    wrapper.appendChild(valueLabel);
    container.appendChild(wrapper);
    return wrapper;
  }

  // Wire the "Add other attribute" button to append an empty other-attribute-item
  const addOtherBtn = document.getElementById('add-other-attribute-item');
  if (addOtherBtn) {
    addOtherBtn.type = 'button';
    addOtherBtn.addEventListener('click', () => {
      createOtherAttributeItem('', '');
    });
  }
// Reuse an existing key creation helper for programmatic insertion
  // This mirrors the addKeyInput DOM structure.
  function createKeyWrapperForData(kd) {
    const wrapper = document.createElement('div');
    wrapper.className = 'key-field';
    wrapper.innerHTML = `
      <label>Base Key
        <input class="base" placeholder="e.g. a" />
      </label>
      <label>Shifted Key
        <input class="shifted" placeholder="(optional) e.g. A" />
      </label>
      <label>More-keys for Base
        <input class="more-base" placeholder="(comma-separated)" />
      </label>
      <label>More-keys for Shifted
        <input class="more-shifted" placeholder="(comma-separated)" />
      </label>
      <button type="button" class="remove-key">Remove Key</button>
    `;
    wrapper.querySelector('.remove-key').onclick = () => wrapper.remove();

    if (typeof kd === 'string') {
      wrapper.querySelector('.base').value = kd;
    } else if (Array.isArray(kd)) {
      wrapper.querySelector('.base').value = kd[0] ?? '';
      wrapper.querySelector('.more-base').value = kd.slice(1).join(', ');
    } else if (kd && typeof kd === 'object' && kd.type === 'case') {
      const normal = kd.normal;
      const shifted = kd.shifted;
      if (Array.isArray(normal)) {
        wrapper.querySelector('.base').value = normal[0] ?? '';
        wrapper.querySelector('.more-base').value = normal.slice(1).join(', ');
      } else if (typeof normal === 'string') {
        wrapper.querySelector('.base').value = normal;
      }
      if (Array.isArray(shifted)) {
        wrapper.querySelector('.shifted').value = shifted[0] ?? '';
        wrapper.querySelector('.more-shifted').value = shifted.slice(1).join(', ');
      } else if (typeof shifted === 'string') {
        wrapper.querySelector('.shifted').value = shifted;
      }
    }

    return wrapper;
  }

  // ---------- Preview-only DOM constructors (do not touch global state) ----------
  function createRowPreview(type) {
    const fs = document.createElement('fieldset');
    fs.dataset.type = type;

    const lg = document.createElement('legend');
    lg.innerHTML = `<span>${type.toUpperCase()} ROW</span>
                    <button type="button" class="remove-row">🗑</button>`;
    fs.appendChild(lg);
    lg.querySelector('.remove-row').onclick = () => fs.remove();

    const keysDiv = document.createElement('div');
    keysDiv.className = 'keys-container';
    fs.appendChild(keysDiv);

    const addKeyBtn = document.createElement('button');
    addKeyBtn.type = 'button';
    addKeyBtn.classList.add('add-key');
    addKeyBtn.textContent = '+ Add Key';
    addKeyBtn.onclick = () => { makeKeyFieldFromDataPreview('', keysDiv); };
    fs.appendChild(addKeyBtn);

    return fs;
  }

  function makeKeyFieldFromDataPreview(keyData, keysContainer) {
    if (keysContainer.children.length >= 12) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'key-field';
    wrapper.innerHTML = `
      <label>Base Key
        <input class="base" placeholder="e.g. a" />
      </label>
      <label>Shifted Key
        <input class="shifted" placeholder="(optional) e.g. A" />
      </label>
      <label>More-keys for Base
        <input class="more-base" placeholder="(comma-separated)" />
      </label>
      <label>More-keys for Shifted
        <input class="more-shifted" placeholder="(comma-separated)" />
      </label>
      <button type="button" class="remove-key">Remove Key</button>
    `;
    wrapper.querySelector('.remove-key').onclick = () => wrapper.remove();

    // fill fields based on the shape of keyData
    if (typeof keyData === 'string') {
      wrapper.querySelector('.base').value = keyData;
    } else if (Array.isArray(keyData)) {
      wrapper.querySelector('.base').value = keyData[0] ?? '';
      wrapper.querySelector('.more-base').value = keyData.slice(1).join(', ');
    } else if (keyData && typeof keyData === 'object' && keyData.type === 'case') {
      const normal = keyData.normal;
      const shifted = keyData.shifted;
      if (Array.isArray(normal)) {
        wrapper.querySelector('.base').value = normal[0] ?? '';
        wrapper.querySelector('.more-base').value = normal.slice(1).join(', ');
      } else if (typeof normal === 'string') {
        wrapper.querySelector('.base').value = normal;
      }
      if (Array.isArray(shifted)) {
        wrapper.querySelector('.shifted').value = shifted[0] ?? '';
        wrapper.querySelector('.more-shifted').value = shifted.slice(1).join(', ');
      } else if (typeof shifted === 'string') {
        wrapper.querySelector('.shifted').value = shifted;
      }
    }

    keysContainer.appendChild(wrapper);
    return true;
  }

  // ---------- Build preview in-memory (returns previewRoot, summary, warnings) ----------
  function buildPreviewFromParsedRows(parsedRows) {
    const previewRoot = document.createElement('div');
    const summary = [];
    const warnings = [];

    let letterCount = 0;
    let sawNumbers = false;
    let sawBottom = false;

    for (const r of parsedRows) {
      const keys = Object.keys(r);
      if (keys.length !== 1) {
        warnings.push('A row entry in YAML did not have exactly one key (skipped).');
        continue;
      }
      const type = keys[0];
      const keysArr = Array.isArray(r[type]) ? r[type] : [];

      if (type === 'numbers') {
        if (sawNumbers) {
          warnings.push('Duplicate numbers row found; subsequent numbers rows will be ignored in preview.');
          continue;
        }
        sawNumbers = true;
      }
      if (type === 'bottom') {
        if (sawBottom) {
          warnings.push('Duplicate bottom row found; subsequent bottom rows will be ignored in preview.');
          continue;
        }
        sawBottom = true;
      }

      if (type === 'letters') {
        letterCount++;
        if (letterCount > 8) {
          warnings.push('More than 8 letters rows present; extra letter rows will be ignored in preview.');
          break;
        }
      }

      const fs = createRowPreview(type);
      const keysDiv = fs.querySelector('.keys-container');

      let added = 0;
      for (const kd of keysArr) {
        if (added >= 12) {
          warnings.push(`A ${type} row has more than 12 keys; extra keys truncated in preview.`);
          break;
        }
        makeKeyFieldFromDataPreview(kd, keysDiv);
        added++;
      }

      previewRoot.appendChild(fs);
      summary.push({ type, keyCount: added });
    }

    const previewWarnings = collectWarnings(previewRoot);
    for (const pw of previewWarnings) warnings.push('(preview) ' + pw);

    return { previewRoot, summary, warnings };
  }

  // ---------- Modal UI (simple, accessible) ----------
  function showImportPreviewModal({ summary, warnings }, onProceed, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'import-modal-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999
    });

    const modal = document.createElement('div');
    modal.className = 'import-modal';
    Object.assign(modal.style, {
      width: '640px', maxHeight: '80vh', overflow: 'auto', background: '#fff', padding: '16px',
      borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
    });

    const title = document.createElement('h3');
    title.textContent = 'Import preview';
    modal.appendChild(title);

    const summaryEl = document.createElement('div');
    summaryEl.innerHTML = `<strong>Summary</strong>`;
    const ul = document.createElement('ul');
    summary.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.type.toUpperCase()} — ${s.keyCount} key(s)`;
      ul.appendChild(li);
    });
    summaryEl.appendChild(ul);
    modal.appendChild(summaryEl);

    const warnEl = document.createElement('div');
    warnEl.innerHTML = `<strong>Issues / Warnings</strong>`;
    if (!warnings || warnings.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No warnings detected in preview.';
      warnEl.appendChild(p);
    } else {
      const wul = document.createElement('ul');
      warnings.forEach(w => {
        const li = document.createElement('li');
        li.textContent = w;
        wul.appendChild(li);
      });
      warnEl.appendChild(wul);
    }
    modal.appendChild(warnEl);

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { marginTop: '12px', textAlign: 'right' });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, { marginRight: '8px' });
    cancelBtn.onclick = () => {
      overlay.remove();
      if (onCancel) onCancel();
    };

    const proceedBtn = document.createElement('button');
    proceedBtn.type = 'button';
    proceedBtn.textContent = 'Proceed';
    proceedBtn.onclick = () => {
      overlay.remove();
      if (onProceed) onProceed();
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(proceedBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    proceedBtn.focus();
  }

  // ---------- Full import flow: parse YAML -> preview -> apply on Proceed ----------
  async function importYamlFileWithPreview(file) {
    try {
      const txt = await readFileAsText(file);
      const obj = jsyaml.load(txt);
      if (!obj || typeof obj !== 'object') {
        alert('YAML did not parse to an object.');
        return;
      }

      // Basic populate of top-level metadata right away (not rows)
      if (typeof obj.name === 'string') document.getElementById('layout-name').value = obj.name;
      if (typeof obj.description === 'string') document.getElementById('layout-desc').value = obj.description;
      if (typeof obj.languages === 'string') document.getElementById('lang-code').value = obj.languages;

      // render any other top-level attributes into section#other-attribute-container
      renderOtherAttributesFromObject(obj);


      const rowDefs = Array.isArray(obj.rows) ? obj.rows : [];
      const { previewRoot, summary, warnings } = buildPreviewFromParsedRows(rowDefs);

      // Show modal with summary + warnings
      showImportPreviewModal({ summary, warnings },
        // onProceed
        () => {
          // apply imported layout to real DOM
          clearRowsContainer();
          letterRowCount = 0;

          for (const r of rowDefs) {
            const keys = Object.keys(r);
            if (keys.length !== 1) continue;
            const type = keys[0];
            const keysArr = Array.isArray(r[type]) ? r[type] : [];

            if (type === 'numbers' && rowsContainer.querySelector('[data-type="numbers"]')) continue;
            if (type === 'bottom' && rowsContainer.querySelector('[data-type="bottom"]')) continue;

            if (type === 'letters') {
              letterRowCount++;
              if (letterRowCount > 8) {
                continue;
              }
            }

            const newRow = createRow(type);
            const keysDiv = newRow.querySelector('.keys-container');

            if (type === 'letters') {
              newRow.querySelector('legend span').textContent = `${letterRowCount} - LETTERS ROW`;
              const bottomRow = rowsContainer.querySelector('[data-type="bottom"]');
              if (bottomRow) rowsContainer.insertBefore(newRow, bottomRow);
              else rowsContainer.appendChild(newRow);
            } else if (type === 'numbers') {
              rowsContainer.prepend(newRow);
            } else {
              rowsContainer.appendChild(newRow);
            }

            let added = 0;
            for (const kd of keysArr) {
              if (added >= 12) break;
              const wrapper = createKeyWrapperForData(kd);
              keysDiv.appendChild(wrapper);
              added++;
            }
          }

          renumberLetterRows();

          // run collectWarnings() on real DOM and show them if any
          const finalWarnings = collectWarnings();
          if (finalWarnings.length) {
            alert('Import completed with warnings:\n' + finalWarnings.join('\\n'));
          } else {
            alert('Import completed successfully with no warnings.');
          }

          // update YAML output
          const yamlStr = jsyaml.dump(obj, { lineWidth: 80 });
          document.getElementById('yaml-output').textContent = yamlStr;

          // enable download button
          const downloadBtn = document.getElementById('download-btn');
          if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.onclick = () => {
              const blob = new Blob([yamlStr], { type: 'text/yaml;charset=utf-8' });
              const name = document.getElementById('layout-name').value.trim() || 'layout';
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = name.replace(/\s+/g, '_') + '.yaml';
              a.click();
              URL.revokeObjectURL(a.href);
            };
          }

          // render the other attributes into the real UI as well
          renderOtherAttributesFromObject(obj);
        },
        // onCancel
        () => {
          // nothing to do; keep current UI unchanged.
        }
      );
    } catch (err) {
      console.error(err);
      alert('Failed to import YAML: ' + (err && err.message ? err.message : String(err)));
    }
  }

  // wire file input to import flow
  if (importInput) {
    importInput.addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      importYamlFileWithPreview(f);
      // reset so same file can be chosen again later
      importInput.value = '';
    });
  }
});
