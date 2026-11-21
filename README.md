# Sean & JC.co — MERN gadget store

MongoDB Atlas + Express + React + Node.js. React/Vite serves a gadget storefront; Express handles product CRUD and demo orders; Mongoose stores products and orders in MongoDB Atlas. The shopping bag is saved in browser localStorage.

## Setup

Requires Node.js 20.19+ (or Node.js 22.12+) and a MongoDB Atlas cluster.

1. Run `npm install`.
2. If `.env` does not already exist, copy the template to the repository root (PowerShell: `Copy-Item .env.example .env`; Command Prompt: `copy .env.example .env`). Do not overwrite an existing `.env`.
3. In Atlas, create a database deployment, create a **database user**, and add your current IP address under **Network Access**. Then select **Connect → Drivers** and copy the provided `mongodb+srv://` URI. Atlas database users are separate from Atlas account users, and Atlas requires both a database user and an IP access-list entry. [MongoDB Atlas connection guide](https://www.mongodb.com/docs/atlas/driver-connection/)
4. Replace the placeholder `MONGODB_URI` in `.env` with that URI. Use `sean-jc-store` as the database name after `.net/`; do not commit `.env` or share the URI.
5. Add `JWT_SECRET` to `.env` without replacing other settings. Generate a random secret of at least 32 bytes with Node.js by running `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` and paste the output as the value. Do not commit or share the generated value. The API refuses to start if the secret is missing or shorter than 32 bytes.
6. Run `npm run seed` to upsert the 14 technology catalog products. The seed removes only the eight known replaced starter products by exact name; it does not wipe collections or delete users or orders.
7. To initialize the first administrator, set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` (at least 12 bytes), and optionally `INITIAL_ADMIN_USERNAME` in `.env`; run `npm run create-admin`, then remove those values. This command refuses to create another admin once one exists. Admins cannot be created through public registration.
8. Run `npm run dev` to launch React and the API together.
9. Open http://localhost:5173 (or the URL Vite prints if that port is occupied).

API defaults to http://localhost:5000. Set `PORT` in `.env` to change it; the Vite proxy uses that port too. Stop any older project servers first. Ctrl+C stops both development processes. If Atlas cannot connect, startup prints a connection error; there is no localStorage fallback for products.

The gadget catalog updates instantly for the browser that makes a change, and other open browsers refresh the Atlas-backed catalog every 15 seconds or when they regain focus.

## Commands

- `npm run dev`: React and API with change watching
- `npm run dev:client`: React only
- `npm run dev:server`: API only
- `npm run seed`: upsert the technology catalog and remove only the retired starter products
- `npm run create-admin`: create the initial administrator from one-time environment values
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
| POST | `/api/auth/register` | Register a customer |
| POST | `/api/auth/login` | Customer login |
| POST | `/api/auth/admin/login` | Administrator login (email or username) |
| GET | `/api/products` | List products |
| GET | `/api/products/:id` | Read a product |
| POST | `/api/products` | Create a product (admin bearer token required) |
| PUT | `/api/products/:id` | Update a product (admin bearer token required) |
| DELETE | `/api/products/:id` | Delete a product (admin bearer token required) |
| GET | `/api/orders` | List the authenticated customer's orders; admins see all |
| POST | `/api/orders` | Store an order (customer bearer token required) |
| PATCH | `/api/orders/:id/status` | Change an order status (admin bearer token required) |
| PATCH | `/api/orders/:id/payment` | Update COD payment status (admin bearer token required) |
| GET | `/api/orders/:id/history` | Read chronological status history (owner or admin) |

Product payload: `name`, `description`, `price` (number), `category` (Phones/Computers/Audio/Wearables/Gaming/Smart Home/Accessories), `image` (HTTP(S) URL), optional `badge`.
Register payload: `{ name, email, password }`. Customer login payload: `{ email, password }`. Admin login payload: `{ identity, password }`, where identity is the admin email or optional username. Successful authentication returns `{ token, user: { id, name, email, role } }`; use `Authorization: Bearer <token>` for protected endpoints. Tokens expire after one hour.
Order payload: `customer: { name, email, address }`, `items: [{ product: "MongoDB product ID", quantity: 1 }]`, and optional `contactNumber`; `shippingAddress` may also be supplied and otherwise uses `customer.address`. New orders start `Pending` with COD payment `Pending`. The server calculates prices and shipping from the database. Submitted client totals are ignored. Legacy orders without a user association are only visible to admins.

Admins update status with `{ status, note? }`. Allowed transitions are Pending → Processing/Cancelled, Processing → Shipped/Cancelled, and Shipped → Delivered; Delivered and Cancelled are terminal. Every new order and status transition records a history entry. Admins mark COD payment paid with `{ paymentStatus: "Paid" }` only after delivery, or cancelled with `{ paymentStatus: "Cancelled" }` only for a cancelled order; delivery does not automatically mark payment as paid. Legacy orders without history return an empty history, and legacy statuses are not migrated or reset.

The authentication API is available, but the current React authentication forms still display “not connected” feedback and do not call it. The product-management UI does not yet attach bearer tokens; checkout and My Orders must also attach the customer token to use protected order endpoints. Finish those frontend integrations before using the protected flows through the UI. Checkout does not collect payment. The old localStorage product catalog is not migrated automatically. Photos and fonts require an internet connection.

## Category pages

Each category has its own shareable URL and filtered catalog:

- `/category/phones`
- `/category/computers`
- `/category/audio`
- `/category/wearables`
- `/category/gaming`
- `/category/smart-home`
- `/category/accessories`

Use the header or collection category links to navigate. Direct links and refreshes work in Vite development and the built Express app. Search and sorting apply within the current category; your bag carries across pages. Each category shares the same product CRUD tools, with its category preselected when adding a product.

Choose a gadget category in **Manage gadgets** to add items to those pages or move existing products there. Existing products using the earlier home-goods categories will need to be updated in the product manager after migrating to Atlas. Category definitions live in `shared/categories.js` and are used by both the frontend and database validation.

`npm test` builds the frontend before running API and category-page integration tests.
