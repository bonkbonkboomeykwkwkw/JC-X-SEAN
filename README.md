# Form & Field — MERN ecommerce starter

MongoDB + Express + React + Node.js. React/Vite serves the storefront; Express handles product CRUD and demo orders; Mongoose stores products and orders in MongoDB. The shopping bag is saved in browser localStorage.

## Setup

Requires Node.js 20.19+ (or Node.js 22.12+) and a running MongoDB server or MongoDB Atlas database.

1. Run `npm install`.
2. Copy configuration: `cp .env.example .env`.
3. Start your local MongoDB service, or replace `MONGODB_URI` in `.env` with your Atlas connection string. Keep credentials out of Git. For Atlas, allow your machine's IP and use a database user with access to the chosen database.
4. Run `npm run seed` to insert the eight starter products. Seeding skips an existing collection without deleting products.
5. Run `npm run dev` to launch React and the API together.
6. Open http://localhost:5173 (or the URL Vite prints if that port is occupied).

API defaults to http://localhost:5000. Set `PORT` in `.env` to change it; the Vite proxy uses that port too. Stop any older project servers first. Ctrl+C stops both development processes. If MongoDB cannot connect, startup prints a connection error; there is no localStorage fallback for products.

## Commands

- `npm run dev`: React and API with change watching
- `npm run dev:client`: React only
- `npm run dev:server`: API only
- `npm run seed`: insert starter products into an empty database
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
| GET | `/api/products` | List products |
| GET | `/api/products/:id` | Read a product |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |
| POST | `/api/orders` | Store a demo order |

Product payload: `name`, `description`, `price` (number), `category` (Furniture/Sports/Living/Lighting/Kitchen/Objects), `image` (HTTP(S) URL), optional `badge`.
Order payload: `customer: { name, email, address }`, `items: [{ product: "MongoDB product ID", quantity: 1 }]`. The server calculates prices and shipping from the database. Submitted client totals are ignored.

This remains a demo: management endpoints have no authentication, and checkout does not collect payment. Add authentication and authorization before exposing product management publicly. Orders contain customer details, so no public order-list endpoint is included. The old localStorage product catalog is not migrated automatically. Photos and fonts require an internet connection.

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
