// script.js

document.addEventListener('DOMContentLoaded', () => {
  const rowsContainer = document.getElementById('rows-container');
  const form = document.getElementById('layout-form');
  let letterRowCount = 0;

  /**
   * Returns an array of warning strings.
   * 1) more-keys without corresponding base/shifted
   * 2) any non-base field populated while base is empty
   */
  function collectWarnings() {
    const warns = [];
    document.querySelectorAll('.key-field').forEach((f, idx) => {
      const base = f.querySelector('.base').value.trim();
      const shifted = f.querySelector('.shifted').value.trim();
      const moreB = f.querySelector('.more-base').value.trim();
      const moreS = f.querySelector('.more-shifted').value.trim();

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
        fs.querySelector('legend span').textContent = `${idx} - LETTERS ROW`;
      });
    letterRowCount = idx;
  }

  // Create a new row (numbers, letters, or bottom)
  function createRow(type) {
    const fs = document.createElement('fieldset');
    fs.dataset.type = type;

    // legend with remove button
    const lg = document.createElement('legend');
    lg.innerHTML = `<span>${type.toUpperCase()} ROW</span>⠀⠀⠀
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
});
