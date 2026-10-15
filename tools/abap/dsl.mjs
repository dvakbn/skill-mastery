// Authoring helpers. In text, § stands for a backtick (replaced at build time).
export const code = s => '§§§abap\n' + s + '\n§§§';
// Q(tag, prompt, correct, [3 wrong], why)
export const Q = (tag, prompt, right, wrong, why) => ({ tag, prompt, right, wrong, why });
