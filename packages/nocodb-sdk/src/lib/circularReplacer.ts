export const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

// Replacer that only removes true circular references, not repeated references
export const getTrueCircularReplacer = () => {
  const stack = []; // objects along the current traversal path

  return function replacer(_, value) {
    // Keep the stack aligned with the current traversal parent (`this`)
    const parentIndex = stack.indexOf(this);
    if (parentIndex === -1) {
      // entering a new branch
      stack.push(this);
    } else {
      // moving to a sibling; pop anything deeper than the current parent
      stack.length = parentIndex + 1;
    }

    if (value && typeof value === 'object') {
      // If the next value is already somewhere in the current path, it's a cycle
      if (stack.indexOf(value) !== -1) {
        // return undefined to avoid circular reference
        return undefined;
      }
      // push this value as we descend into it next
      stack.push(value);
    }

    return value;
  };
};
