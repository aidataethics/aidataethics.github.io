// The toolkit's sentiment model: a word-weight lexicon (data/sentiment-model-v2.json)
// with bigrams, intensifiers, negation and a "but"-clause rule. One scorer, used by
// the Model Explainability Lab and the Behavioral Testing Lab, so the model students
// explain is exactly the model they test. Also loadable in Node (module.exports), so
// course materials can be generated from the same code.
//
// score(model, text, { negation }) -> { wordScores, totalScore, prob, aspectScores, words }
// negation: false switches off negation handling - an ablation, used only to give the
// Behavioral Testing Lab a second model to compare against.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SentimentModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function score(sentimentModel, text, options = {}) {
        const handleNegation = options.negation !== false;
        const weights = sentimentModel.weights;
        const bigrams = sentimentModel.bigrams || {};
        const intensifiers = sentimentModel.intensifiers || {};
        const negatorSet = new Set(sentimentModel.negators || []);
        const contrastiveSet = new Set(sentimentModel.contrastive || []);
        const idfMap = sentimentModel.idf || {};
        const aspects = sentimentModel.aspects || {};

        const words = text.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean);

        // Term frequency
        const tf = {};
        words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
        const maxTF = Math.max(1, ...Object.values(tf));

        // Detect bigrams
        const bigramHits = [];
        for (let i = 0; i < words.length - 1; i++) {
            const bg = words[i] + ' ' + words[i + 1];
            if (bigrams[bg] !== undefined) {
                bigramHits.push({ index: i, bigram: bg, score: bigrams[bg] });
            }
        }
        const bigramIndices = new Set();
        bigramHits.forEach(b => { bigramIndices.add(b.index); bigramIndices.add(b.index + 1); });

        // Contrastive segmentation — words after 'but' get 1.5x weight
        let contrastiveActive = false;
        let contrastiveMultiplier = 1.0;

        const wordScores = [];
        let totalScore = sentimentModel.intercept || 0;
        let negated = false;
        let intensifyMultiplier = 1.0;
        const aspectScores = {}; // aspect -> { total, count, words }

        words.forEach((word, i) => {
            // Contrastive conjunction shifts weighting
            if (contrastiveSet.has(word)) {
                contrastiveActive = true;
                contrastiveMultiplier = 1.5; // post-contrastive clause gets more weight
                negated = false;
                intensifyMultiplier = 1.0;
                wordScores.push({ word, score: 0, role: 'contrastive' });
                return;
            }

            if (negatorSet.has(word)) {
                // Ablation (Behavioral Testing Lab only): with negation
                // handling off, a negator is read as a neutral word.
                if (!handleNegation) {
                    wordScores.push({ word, score: 0, role: 'neutral', source: 'unigram' });
                    return;
                }
                negated = true;
                wordScores.push({ word, score: 0, role: 'negator' });
                return;
            }

            if (intensifiers[word] !== undefined) {
                intensifyMultiplier = intensifiers[word];
                wordScores.push({ word, score: 0, role: 'intensifier' });
                return;
            }

            let score = 0;
            let source = 'unigram';

            // Check if part of a scored bigram
            if (bigramIndices.has(i)) {
                const hit = bigramHits.find(b => b.index === i);
                if (hit) {
                    const idf = idfMap[hit.bigram] || 4.0;
                    score = hit.score * (idf / 3);
                    source = 'bigram';
                }
            } else if (weights[word] !== undefined) {
                const termFreq = 0.5 + 0.5 * (tf[word] / maxTF);
                const idf = idfMap[word] || 1.0;
                score = weights[word] * termFreq * (idf / 2);
            }

            if (negated && score !== 0) {
                score = -score * 0.8;
                negated = false;
            }
            if (intensifyMultiplier !== 1.0 && score !== 0) {
                score *= intensifyMultiplier;
                intensifyMultiplier = 1.0;
            }
            score *= contrastiveMultiplier;

            // Aspect tracking
            for (const [aspect, keywords] of Object.entries(aspects)) {
                if (keywords.includes(word)) {
                    if (!aspectScores[aspect]) aspectScores[aspect] = { total: 0, count: 0, words: [] };
                    aspectScores[aspect].words.push(word);
                }
            }
            // Assign score to nearest aspect
            if (score !== 0) {
                for (const [aspect, keywords] of Object.entries(aspects)) {
                    if (keywords.includes(word)) {
                        if (!aspectScores[aspect]) aspectScores[aspect] = { total: 0, count: 0, words: [] };
                        aspectScores[aspect].total += score;
                        aspectScores[aspect].count++;
                    }
                }
            }

            totalScore += score;
            wordScores.push({ word, score, role: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral', source });
        });

        // Add bigram scores for display
        bigramHits.forEach(b => {
            const idf = idfMap[b.bigram] || 4.0;
            let s = b.score * (idf / 3) * contrastiveMultiplier;
            wordScores.push({ word: b.bigram, score: s, role: s > 0 ? 'positive' : 'negative', source: 'bigram_display' });
        });

        const sigmoid = x => 1 / (1 + Math.exp(-x));
        const prob = sigmoid(totalScore);

        return { wordScores, totalScore, prob, aspectScores, words };
    }

    return { score };
});
