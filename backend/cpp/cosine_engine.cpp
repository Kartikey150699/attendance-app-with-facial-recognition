#include <vector>
#include <cmath>

// ----------
// This function takes two lists (vectors) of numbers
// and returns how similar they are (cosine similarity)
// ----------
extern "C" double cosine_similarity(const double* a, const double* b, int size) {
    double dot = 0.0;
    double normA = 0.0;
    double normB = 0.0;

    for (int i = 0; i < size; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    double result = dot / (std::sqrt(normA) * std::sqrt(normB) + 1e-10);
    return result;
}