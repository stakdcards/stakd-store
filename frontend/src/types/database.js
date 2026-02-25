/**
 * Database type definitions for Supabase (public schema).
 * Use in JSDoc via @typedef or in TypeScript via import type.
 */

/**
 * Product image item stored in products.images JSONB.
 * @typedef {{ id: string; dataUrl?: string; name?: string }} ProductImage
 */

/**
 * Product category slug.
 * @typedef {'video-games' | 'anime' | 'esports'} ProductCategory
 */

/**
 * Order status.
 * @typedef {'pending' | 'paid' | 'shipped' | 'cancelled'} OrderStatus
 */

/**
 * Profile role for RLS / admin checks.
 * @typedef {'user' | 'admin'} ProfileRole
 */

/**
 * products table row (snake_case as in DB).
 * @typedef {Object} ProductRow
 * @property {string} id - Primary key (e.g. 'vg-geralt')
 * @property {string} name
 * @property {string | null} subtitle
 * @property {string | null} franchise
 * @property {ProductCategory} category
 * @property {number} price
 * @property {boolean} limited
 * @property {boolean} in_stock
 * @property {boolean} featured
 * @property {string | null} description
 * @property {string | null} dimensions
 * @property {string | null} materials
 * @property {string | null} bg_color - Hex background color
 * @property {string | null} accent_color - Hex accent color
 * @property {string[]} palette - Array of hex color strings
 * @property {ProductImage[]} images - Product photos (id, dataUrl?, name?)
 * @property {string} [created_at] - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * products insert (all fields optional except required columns).
 * @typedef {Object} ProductInsert
 * @property {string} id
 * @property {string} name
 * @property {string} [subtitle]
 * @property {string} [franchise]
 * @property {ProductCategory} category
 * @property {number} price
 * @property {boolean} [limited]
 * @property {boolean} [in_stock]
 * @property {boolean} [featured]
 * @property {string} [description]
 * @property {string} [dimensions]
 * @property {string} [materials]
 * @property {string} [bg_color]
 * @property {string} [accent_color]
 * @property {string[]} [palette]
 * @property {ProductImage[]} [images]
 */

/**
 * orders table row.
 * @typedef {Object} OrderRow
 * @property {string} id - UUID
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} email
 * @property {string | null} phone
 * @property {string} address
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {OrderStatus} status
 * @property {string} shipping_method
 * @property {number} shipping_cost
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} total
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Order insert payload (no id; status defaults to 'pending').
 * @typedef {Object} OrderInsert
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} email
 * @property {string} [phone]
 * @property {string} address
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {string} shipping_method
 * @property {number} shipping_cost
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} total
 */

/**
 * order_items table row.
 * @typedef {Object} OrderItemRow
 * @property {string} id - UUID
 * @property {string} order_id
 * @property {string} product_id
 * @property {number} quantity
 * @property {number} price_at_time
 * @property {string} created_at
 */

/**
 * Order item insert payload.
 * @typedef {Object} OrderItemInsert
 * @property {string} order_id
 * @property {string} product_id
 * @property {number} quantity
 * @property {number} price_at_time
 */

/**
 * Order with nested order_items and product names (for admin list).
 * @typedef {OrderRow & { order_items: (OrderItemRow & { products?: { id: string; name: string } | null })[] }} OrderWithItems
 */

/**
 * profiles table row (auth-linked).
 * @typedef {Object} ProfileRow
 * @property {string} id - UUID, references auth.users(id)
 * @property {ProfileRole} role
 * @property {string} created_at
 * @property {string} updated_at
 */

export default {};
