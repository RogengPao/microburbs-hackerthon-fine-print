// Minimal JSON Schema validator — stands in for Python's jsonschema
// (Draft 2020-12) without a bundler or dependency.
//
// Supports the subset tool/output schemas actually use: type (incl. arrays of
// types), properties, required, additionalProperties:false, items, enum, const,
// minimum/maximum, minLength/maxLength, minItems/maxItems. Unknown keywords are
// ignored (permissive), so a schema using more than this subset validates LESS
// strictly here than in Python — keep tool schemas inside the subset.

const TYPE_CHECKS = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: Number.isInteger,
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
};

/** @returns {string[]} errors as "<path>: <message>", empty when valid */
export function validate(schema, value, path = '') {
  const at = path || '<root>';
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => TYPE_CHECKS[t]?.(value))) {
      errors.push(`${at}: ${JSON.stringify(value)} is not of type ${types.map((t) => `'${t}'`).join(', ')}`);
      return errors; // further keywords are meaningless on the wrong type
    }
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    errors.push(`${at}: ${JSON.stringify(schema.const)} was expected`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: ${value} is less than the minimum of ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: ${value} is greater than the maximum of ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: ${JSON.stringify(value)} is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${at}: ${JSON.stringify(value)} is too long`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: should have at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: should have at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items, item, path ? `${path}/${i}` : String(i))));
  }
  if (TYPE_CHECKS.object(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${at}: '${key}' is a required property`);
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) errors.push(...validate(sub, value[key], path ? `${path}/${key}` : key));
    }
    if (schema.additionalProperties === false) {
      const extra = Object.keys(value).filter((k) => !(k in props));
      if (extra.length) errors.push(`${at}: additional properties are not allowed (${extra.map((k) => `'${k}'`).join(', ')})`);
    }
  }
  return errors;
}
