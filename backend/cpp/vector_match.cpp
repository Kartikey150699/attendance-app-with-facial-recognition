#include <vector>
#include <cmath>
#include <iostream>

extern "C" {

// 🔗 Use cosine_similarity from cosine_engine.cpp
double cosine_similarity(const double* a, const double* b, int len);

// ==========================================================
// best_match — finds the embedding most similar to input
// ==========================================================
int best_match(const double* input,
               const double* all_embeddings,
               int n_users,
               int dim,
               double* best_score) {

    double max_score = -1.0;
    int best_index = -1;

    for (int i = 0; i < n_users; ++i) {
        const double* candidate = all_embeddings + i * dim;
        double score = cosine_similarity(input, candidate, dim);
        if (score > max_score) {
            max_score = score;
            best_index = i;
        }
    }

    *best_score = max_score;
    return best_index;
}
}