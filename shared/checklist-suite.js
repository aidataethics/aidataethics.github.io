// The Behavioral Testing Lab's default suite for the toolkit's sentiment model,
// adapted from the sentiment suite in CheckList (Ribeiro et al., ACL 2020;
// github.com/marcotcr/checklist, MIT). Word lists are ordinary English chosen
// without looking at the model's lexicon - a test suite written from what the
// model *should* handle, not from what it happens to know. Changing a template
// or a list changes the generated cases and therefore every failure rate, and
// the course handout's worksheet numbers are generated from this file.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CheckListSuite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const LEXICONS = {
        noun: ['movie', 'film', 'book', 'meal', 'hotel', 'phone', 'show', 'album', 'game', 'service'],
        pos_adj: ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'enjoyable', 'brilliant',
                  'lovely', 'beautiful', 'perfect', 'superb', 'nice', 'fun', 'impressive', 'delightful'],
        neg_adj: ['bad', 'terrible', 'awful', 'horrible', 'boring', 'poor', 'disappointing', 'dreadful',
                  'mediocre', 'ugly', 'lousy', 'weak', 'annoying', 'dull', 'unpleasant', 'frustrating'],
        neutral_adj: ['American', 'international', 'commercial', 'private', 'digital', 'French',
                      'British', 'modern', 'standard', 'local'],
        pos_verb: ['love', 'like', 'enjoy', 'admire', 'appreciate', 'recommend'],
        neg_verb: ['hate', 'dislike', 'regret', 'despise', 'resent'],
        intens: ['very', 'really', 'so', 'extremely', 'absolutely'],
        first_name: ['Emily', 'Jamal', 'Priya', 'Wei', 'Maria', 'John', 'Aisha', 'Diego', 'Hannah', 'Kwame',
                     'Joy', 'Hope', 'Grace'],
        city: ['Chicago', 'Lagos', 'Mumbai', 'Beijing', 'Mexico City', 'Paris', 'Cairo', 'Seoul', 'Toronto', 'Allentown'],
        pos_phrase: ['I loved it.', 'Highly recommended.', 'It was a joy.', 'Worth every penny.', 'I would go again.'],
        neg_phrase: ['I hated it.', 'Never again.', 'What a waste.', 'Avoid it.', 'It was a mistake.'],
    };

    // Each test: id (stable; it seeds generation), capability, type, name,
    // template, n (cases kept), and one of: expect (MFT), perturb (INV),
    // phrases + direction (DIR).
    const TESTS = [
        // Vocabulary
        { id: 'voc-pos', capability: 'Vocabulary', type: 'MFT', name: 'Positive adjectives',
          template: 'This is a {pos_adj} {noun}.', expect: 'positive', n: 40 },
        { id: 'voc-neg', capability: 'Vocabulary', type: 'MFT', name: 'Negative adjectives',
          template: 'This is a {neg_adj} {noun}.', expect: 'negative', n: 40 },
        { id: 'voc-neutral', capability: 'Vocabulary', type: 'MFT', name: 'Neutral adjectives carry no sentiment',
          template: 'This is a {neutral_adj} {noun}.', expect: 'neutral', n: 30 },
        { id: 'voc-verbs', capability: 'Vocabulary', type: 'MFT', name: 'Positive verbs',
          template: 'I {pos_verb} this {noun}.', expect: 'positive', n: 30 },
        { id: 'voc-intens', capability: 'Vocabulary', type: 'MFT', name: 'Intensified negative adjectives',
          template: 'The {noun} was {intens} {neg_adj}.', expect: 'negative', n: 40 },
        { id: 'dir-pos', capability: 'Vocabulary', type: 'DIR', name: 'Adding a positive phrase should not lower the score',
          template: 'The {noun} was {neg_adj}.', phrases: 'pos_phrase', direction: 'up', n: 20 },
        { id: 'dir-neg', capability: 'Vocabulary', type: 'DIR', name: 'Adding a negative phrase should not raise the score',
          template: 'The {noun} was {pos_adj}.', phrases: 'neg_phrase', direction: 'down', n: 20 },

        // Negation
        { id: 'neg-pos', capability: 'Negation', type: 'MFT', name: 'Negated positive is negative',
          template: 'This {noun} is not {pos_adj}.', expect: 'negative', n: 40 },
        { id: 'neg-neg', capability: 'Negation', type: 'MFT', name: 'Negated negative is not negative',
          template: 'This {noun} is not {neg_adj}.', expect: 'not-negative', n: 40 },
        { id: 'neg-intens', capability: 'Negation', type: 'MFT', name: 'Negation across an intensifier',
          template: 'This {noun} is not {intens} {pos_adj}.', expect: 'negative', n: 40 },
        { id: 'neg-distance', capability: 'Negation', type: 'MFT', name: 'Negation at a distance',
          template: "I don't think this {noun} is {pos_adj}.", expect: 'negative', n: 40 },

        // Robustness
        { id: 'rob-typo', capability: 'Robustness', type: 'INV', name: 'A typo should not change the label',
          template: 'The {noun} was {pos_adj}.', perturb: 'typo', n: 40 },
        { id: 'rob-contract', capability: 'Robustness', type: 'INV', name: "Contractions (is not ↔ isn't)",
          template: 'The {noun} is not {neg_adj}.', perturb: 'contractions', n: 30 },
        { id: 'rob-url', capability: 'Robustness', type: 'INV', name: 'A link or handle should not matter',
          template: 'The {noun} was {neg_adj}.', perturb: 'add_url', n: 30 },
        { id: 'rob-punct', capability: 'Robustness', type: 'INV', name: 'Punctuation should not matter',
          template: 'The {noun} was {pos_adj}.', perturb: 'punctuation', n: 30 },

        // Fairness (named entities)
        { id: 'fair-names', capability: 'Fairness', type: 'INV', name: "Changing a person's name should not matter",
          template: '{first_name} said the {noun} was {neg_adj}.', perturb: 'change_names', n: 40 },
        { id: 'fair-city', capability: 'Fairness', type: 'INV', name: 'Changing the city should not matter',
          template: 'The {noun} in {city} was {pos_adj}.', perturb: 'change_locations', n: 30 },

        // Temporal
        { id: 'temp-change', capability: 'Temporal', type: 'MFT', name: 'Present opinion outweighs past opinion',
          template: 'I used to think this {noun} was {neg_adj}, but now I think it is {pos_adj}.', expect: 'positive', n: 40 },
        { id: 'temp-change-rev', capability: 'Temporal', type: 'MFT', name: 'Present opinion outweighs past opinion (reversed)',
          template: 'I used to think this {noun} was {pos_adj}, but now I think it is {neg_adj}.', expect: 'negative', n: 40 },

        // Semantic roles: whose opinion counts
        { id: 'srl-mine-last', capability: 'Semantic roles', type: 'MFT', name: "The writer's opinion counts, stated last",
          template: 'Some people say the {noun} is {neg_adj}, but I think it is {pos_adj}.', expect: 'positive', n: 40 },
        { id: 'srl-mine-first', capability: 'Semantic roles', type: 'MFT', name: "The writer's opinion counts, stated first",
          template: 'I think the {noun} is {pos_adj}, but some people say it is {neg_adj}.', expect: 'positive', n: 40 },
    ];

    const CAPABILITIES = ['Vocabulary', 'Negation', 'Robustness', 'Fairness', 'Temporal', 'Semantic roles'];

    return { LEXICONS, TESTS, CAPABILITIES };
});
