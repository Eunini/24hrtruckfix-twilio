/**
 * Pagination Helper Function
 * @param {Array} data - The full dataset to paginate
 * @param {Object} options - Pagination options
 * @param {number} [options.page=1] - Current page number (1-based)
 * @param {number} [options.perPage=10] - Items per page
 * @returns {Object} Pagination result with metadata
 */
function paginate(data, { page = 1, perPage = 10 } = {}) {
    // Validate inputs
    if (!Array.isArray(data)) {
        throw new TypeError('Expected an array for data');
    }

    // Convert page and perPage to numbers
    page = Number(page) || 1;
    perPage = Number(perPage) || 10;

    // Calculate pagination values
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const currentPage = Math.min(Math.max(1, page), totalPages); // Clamp between 1 and totalPages
    const offset = (currentPage - 1) * perPage;

    // Get paginated data
    const paginatedData = data.slice(offset, offset + perPage);

    // Calculate next/previous pages
    const hasNext = currentPage < totalPages;
    const hasPrev = currentPage > 1;
    const nextPage = hasNext ? currentPage + 1 : null;
    const prevPage = hasPrev ? currentPage - 1 : null;

    return {
        data: paginatedData,
        meta: {
            totalItems,
            totalPages,
            currentPage,
            perPage,
            hasNext,
            hasPrev,
            nextPage,
            prevPage,
            from: totalItems > 0 ? offset + 1 : 0,
            to: Math.min(offset + perPage, totalItems)
        }
    };
}