# Form & Field — MERN ecommerce starter

MongoDB + Express + React + Node.js. React/Vite serves the storefront; Express handles product CRUD and demo orders; Mongoose stores products and orders in MongoDB. The shopping bag is saved in browser localStorage.

## Running locally

Requires Node.js 20.19+ (or Node.js 22.12+) and a running MongoDB server or MongoDB Atlas database.

1. Install and start MongoDB locally, or create an Atlas cluster and database user.
2. Run `npm install`.
3. Copy `.env.example` to `.env`. The local URI is ready to use; for Atlas, replace `MONGODB_URI` with your Atlas URI and placeholders. Keep credentials out of Git.
4. Run `npm run seed` to add or refresh the ten starter products. Seeding is safe to rerun and does not delete other products.
5. Run `npm run dev` to launch React and the API together.
6. Open http://localhost:5173 (or the URL Vite prints if that port is occupied).

API defaults to http://localhost:5000. Set `PORT` in `.env` to change it; the Vite proxy uses that port too. Stop any older project servers first. Ctrl+C stops both development processes. If MongoDB cannot connect, startup prints a connection error; there is no localStorage fallback for products.

## Commands

- `npm run dev`: React and API with change watching
- `npm run client`: React only
- `npm run server`: API only
- `npm run dev:client`: React only
- `npm run dev:server`: API only
- `npm run seed`: upsert the starter products
- `npm run build`: compile React into `client/dist`
- `npm start`: serve the API and built frontend on port 5000
- `npm test`: API integration tests using an isolated temporary MongoDB instance (downloads MongoDB on first run; does not touch your configured database)

## Structure

- `client/src/main.jsx`: React catalog, cart, management forms, checkout
- `client/src/StoreHeader.jsx`: storefront header and hero
- `client/src/style.css`: responsive styles
- `server/app.js`: Express API and frontend serving
- `server/models/`: Mongoose Product and Order schemas
- `server/seed.js`: non-destructive initial catalog seed
- `server.js`: database connection and server startup

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database readiness |
| GET | `/api/products` | List products; optionally filter with `?category=Living` |
| GET | `/api/products/:id` | Read a product |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |
| POST | `/api/orders` | Store a demo order |
| GET | `/api/orders` | List orders |

Product payload: `name`, `description`, `price` (number), `category` (Furniture/Sports/Living/Lighting/Kitchen/Objects), `image` (HTTP(S) URL), optional `badge`.
Order payload: `customer: { name, email, address }`, `items: [{ product: "MongoDB product ID", quantity: 1 }]`. The server calculates prices and shipping from the database. Submitted client totals are ignored.

This remains a demo: management endpoints and the order list have no authentication, and checkout does not collect payment. Add authentication and authorization before exposing them publicly. Orders contain customer details. The old localStorage product catalog is not migrated automatically. Photos and fonts require an internet connection.

## Category pages

Each category has its own shareable URL and filtered catalog:

- `/category/furniture`
- `/category/sports`
- `/category/living`
- `/category/lighting`
- `/category/kitchen`
- `/category/objects`

Use the header or collection category links to navigate. Direct links and refreshes work in Vite development and the built Express app. Search and sorting apply within the current category; your bag carries across pages. Each category shares the same product CRUD tools, with its category preselected when adding a product.

Choose Sports or Furniture in **Manage store** to add items to those pages or move existing products there. Existing MongoDB products keep their categories; no database reset or reseed is necessary. Empty categories show a helpful message until products are added. Category definitions live in `shared/categories.js` and are used by both the frontend and database validation.

`npm test` builds the frontend before running API and category-page integration tests.
