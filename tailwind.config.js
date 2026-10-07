/** Tailwind build for the AI & Data Ethics Toolkit.
 *
 *  Build with:  npm run build:css
 *
 *  Visual system: ink on paper. Every colour utility the pages use resolves to
 *  a small set of design tokens defined in shared/toolkit.css (the --c-*
 *  variables), and those tokens switch with the theme. That is how thirteen
 *  pages written against Tailwind's stock palette pick up one coherent look
 *  without rewriting their markup:
 *
 *    - the slate/gray neutrals become a blue-black ink ramp on warm paper;
 *    - every decorative hue (blue, indigo, purple, pink, teal, cyan, emerald,
 *      sky, violet) collapses onto the single accent ink - blue by day, gold by
 *      night - so tools no longer each wear their own colour;
 *    - red, green and amber/orange/yellow are kept, but only as status colours
 *      (fail / pass / caution), toned to sit on paper.
 *
 *  The same tokens drive the hairline figures (shared/line-figure.css), so the
 *  drawings and the pages read as one hand.
 */

// A theme-switching token, usable with Tailwind's opacity modifiers (bg-x/10).
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;
// A pale tint of a token over the card surface, for the 50/100/200 shades that
// pages use as soft backgrounds.
const tint = (name, pct) => `color-mix(in srgb, rgb(var(${name})) ${pct}%, rgb(var(--c-surface)))`;

const ramp = (name) => ({
    50: tint(name, 6),
    100: tint(name, 10),
    200: tint(name, 18),
    300: token(name),
    400: token(name),
    500: token(name),
    600: token(`${name}-strong`),
    700: token(`${name}-strong`),
    800: token(`${name}-strong`),
    900: token(`${name}-strong`),
    950: token(`${name}-strong`),
});

// Neutrals. Fixed values except 400/500, which pages use as secondary text in
// BOTH themes (text-slate-400 and dark:text-slate-400); those switch so they
// keep at least 4.5:1 contrast on either paper.
const neutral = {
    50: '#f6f3ec',
    100: '#eeeadf',
    200: '#e1dccf',
    300: '#c4bfb2',
    400: token('--n-400'),
    500: token('--n-500'),
    600: '#4c5060',
    700: '#383d4e',
    800: '#262b39',
    900: '#1b2030',
    950: '#11151f',
};

const accent = ramp('--c-accent');

module.exports = {
    darkMode: 'class',
    content: [
        './*.html',
        './tools/*.html',
        './shared/*.js',
    ],
    // Colour utilities assembled at runtime from data (risk levels, framework
    // colours) are invisible to the content scanner, so they are listed
    // explicitly. Dropping this breaks them silently.
    safelist: [
        {
            pattern: /^(bg|text|border)-(blue|purple|orange|red|teal|indigo|pink|cyan|emerald|green|yellow|slate|amber)-(400|500|600)$/,
            variants: ['dark', 'hover', 'dark:hover'],
        },
        {
            pattern: /^bg-(blue|purple|orange|red|teal|indigo|pink|cyan|emerald|green|yellow|amber)-500\/(5|10|20|30)$/,
        },
        {
            pattern: /^border-(green|red|yellow|orange|purple|amber|slate)-500\/(20|30|40)$/,
        },
    ],
    theme: {
        extend: {
            colors: {
                primary: token('--c-accent'),
                'primary-hover': token('--c-accent-strong'),
                'primary-light': token('--c-accent'),
                'background-light': token('--c-paper'),
                'background-dark': token('--c-paper'),
                'surface-dark': token('--c-surface'),
                'surface-dark-lighter': token('--c-surface-2'),
                danger: token('--c-danger'),
                success: token('--c-success'),
                warning: token('--c-warn'),

                slate: neutral,
                gray: neutral,
                zinc: neutral,
                neutral,

                blue: accent, indigo: accent, purple: accent, violet: accent,
                pink: accent, fuchsia: accent, teal: accent, cyan: accent,
                emerald: accent, sky: accent,

                red: ramp('--c-danger'),
                rose: ramp('--c-danger'),
                green: ramp('--c-success'),
                lime: ramp('--c-success'),
                amber: ramp('--c-warn'),
                yellow: ramp('--c-warn'),
                orange: ramp('--c-warn'),
            },
            fontFamily: {
                display: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                serif: ['Newsreader', 'Georgia', '"Times New Roman"', 'serif'],
                mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
            },
            fontSize: {
                // Raised floor: the smallest utility is 12.5px. Pages used
                // arbitrary 9-11px sizes for body copy, which fails at
                // projection distance and for low-vision readers.
                xs: ['0.78rem', { lineHeight: '1.15rem' }],
                sm: ['0.875rem', { lineHeight: '1.35rem' }],
            },
            borderRadius: {
                // Quieter corners: soft-pill cards read as a template.
                DEFAULT: '3px',
                md: '4px',
                lg: '5px',
                xl: '6px',
                '2xl': '8px',
                full: '9999px',
            },
            boxShadow: {
                // Ink on paper does not float. Elevation comes from rules.
                sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', xl: 'none',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
};
