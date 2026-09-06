/** RFC4180-style parsing, including BOM, quoted commas and multiline fields. */
export function parseCsv(text: string): Record<string,string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i+1] === '"') {cell += '"'; i++;} else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '').trim()); cell = '';
      if (c === '\n') {if (row.some(Boolean)) rows.push(row); row = [];}
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(cell.replace(/\r$/, '').trim()); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (!headers || new Set(headers).size !== headers.length) throw new Error('Missing or duplicate CSV headers');
  return rows.map(values => {
    if (values.length !== headers.length) throw new Error('CSV row does not match its schema');
    return Object.fromEntries(headers.map((h,i) => [h,values[i]]));
  });
}

