// Shared store constants (kept out of the component files so App.jsx and ProductsPage.jsx
// can both import them without a circular dependency).

// Ordered list of the 14 retailers — matches the column order of the Product Master sheet.
export const RETAILERS = ['Tops', 'Villa', 'The Mall', 'Lotus', 'Homepro', 'Big C', 'TWD', 'Boots', 'Foodland', 'Central Department', "Pet'n me", 'Fuji', 'Watsons', 'Golden Place']

// These two logo files ship with wide empty margins, so the tiles crop them with
// object-fit: cover instead of letterboxing them (the files themselves are not edited).
export const COVER_FIT_RETAILERS = new Set(['Central Department', 'Boots'])
