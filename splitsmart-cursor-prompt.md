# SplitSmart — Cursor AI Prompt

> Paste this entire prompt into Cursor's AI panel (or use it as your project rules file at `.cursor/rules`). It gives Cursor full context about what you're building, the tech stack, folder structure, and every feature — so every suggestion it makes is aligned with your project.

---

## Project Overview

Build **SplitSmart** — an AI-powered group expense splitter web app. It allows users to create groups, add expenses manually or by uploading a photo of a bill (parsed by Gemini Vision API), and settle debts using a minimum cash flow algorithm. Group members can assign bill items to themselves in real-time via Socket.io.

This is a portfolio project for a computer science student targeting software engineering internships in India. Code should be clean, well-commented, and production-ready. Prioritize simplicity and clarity over over-engineering.

---

## Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (access token + refresh token pattern)
- **Real-time:** Socket.io
- **File uploads:** Multer (memory storage — no disk writes)
- **Image hosting:** Cloudinary (for storing bill images long-term)
- **AI:** Google Gemini Vision API via `@google/generative-ai` npm package
- **Email:** Nodemailer (optional — for invite emails)
- **Environment:** dotenv

### Frontend
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **State management:** React Context API (no Redux — keep it simple)
- **HTTP client:** Axios with interceptors for JWT refresh
- **Real-time:** Socket.io-client
- **Routing:** React Router v6
- **Notifications:** react-hot-toast

### Deployment
- **Backend:** Render (free tier)
- **Frontend:** Vercel (free tier)
- **Database:** MongoDB Atlas (free M0 cluster)
- **Images:** Cloudinary (free tier)

---

## Folder Structure

```
splitsmart/
├── server/                        # Express backend
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── groupController.js
│   │   ├── expenseController.js
│   │   └── billController.js      # Gemini Vision parsing
│   ├── middleware/
│   │   ├── authMiddleware.js      # JWT verification
│   │   └── errorMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Group.js
│   │   └── Expense.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── groups.js
│   │   ├── expenses.js
│   │   └── bills.js
│   ├── utils/
│   │   ├── debtSimplification.js  # Minimum cash flow algorithm
│   │   └── generateToken.js
│   ├── socket/
│   │   └── handlers.js            # Socket.io event handlers
│   ├── .env                       # Never commit this
│   ├── server.js                  # Entry point
│   └── package.json
│
└── client/                        # React frontend
    ├── src/
    │   ├── api/
    │   │   └── axios.js           # Axios instance with interceptors
    │   ├── components/
    │   │   ├── auth/
    │   │   │   ├── LoginForm.jsx
    │   │   │   └── RegisterForm.jsx
    │   │   ├── groups/
    │   │   │   ├── GroupCard.jsx
    │   │   │   ├── GroupList.jsx
    │   │   │   └── CreateGroupModal.jsx
    │   │   ├── expenses/
    │   │   │   ├── ExpenseForm.jsx
    │   │   │   ├── ExpenseList.jsx
    │   │   │   └── BillUploader.jsx
    │   │   ├── settlement/
    │   │   │   └── SettlementSummary.jsx
    │   │   └── shared/
    │   │       ├── Navbar.jsx
    │   │       ├── ProtectedRoute.jsx
    │   │       └── LoadingSpinner.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── SocketContext.jsx
    │   ├── pages/
    │   │   ├── Landing.jsx
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── GroupDetail.jsx
    │   │   └── Settlement.jsx
    │   ├── hooks/
    │   │   ├── useAuth.js
    │   │   └── useSocket.js
    │   ├── utils/
    │   │   └── formatCurrency.js
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    └── package.json
```

---

## Environment Variables

### server/.env
```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLIENT_URL=http://localhost:5173
```

### client/.env
```
VITE_API_URL=http://localhost:5000
```

---

## Data Models

### User Model — `server/models/User.js`
```js
{
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },        // bcrypt hashed
  avatar: { type: String, default: '' },             // initials-based, generated on frontend
  createdAt: { type: Date, default: Date.now }
}
```

### Group Model — `server/models/Group.js`
```js
{
  name: { type: String, required: true },
  description: { type: String, default: '' },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  inviteToken: { type: String, unique: true },       // for shareable invite link
  inviteTokenExpiry: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}
```

### Expense Model — `server/models/Expense.js`
```js
{
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  description: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    settled: { type: Boolean, default: false }
  }],
  billImageUrl: { type: String, default: '' },       // Cloudinary URL
  parsedItems: [{                                    // From Gemini Vision
    name: String,
    price: Number,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  }],
  category: {
    type: String,
    enum: ['food', 'travel', 'accommodation', 'entertainment', 'utilities', 'other'],
    default: 'other'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}
```

---

## API Routes

### Auth — `/api/auth`
| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login, returns access + refresh tokens | No |
| POST | `/refresh` | Get new access token using refresh token | No |
| POST | `/logout` | Invalidate refresh token | Yes |
| GET | `/me` | Get current user profile | Yes |

### Groups — `/api/groups`
| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all groups for current user | Yes |
| POST | `/` | Create a new group | Yes |
| GET | `/:id` | Get group details with members + expenses | Yes |
| PUT | `/:id` | Update group name/description | Yes (admin) |
| DELETE | `/:id` | Delete group | Yes (admin) |
| POST | `/:id/invite` | Generate invite link (token valid 7 days) | Yes (admin) |
| POST | `/join/:token` | Join group via invite token | Yes |
| DELETE | `/:id/members/:userId` | Remove member from group | Yes (admin) |

### Expenses — `/api/expenses`
| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|---------------|
| GET | `/group/:groupId` | Get all expenses for a group | Yes |
| POST | `/` | Add new expense manually | Yes |
| PUT | `/:id` | Edit expense | Yes |
| DELETE | `/:id` | Delete expense | Yes |
| PUT | `/:id/settle` | Mark a split as settled | Yes |
| PUT | `/:id/assign-item` | Assign a parsed bill item to a user | Yes |

### Bills — `/api/bills`
| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|---------------|
| POST | `/parse` | Upload bill photo → Gemini Vision → returns parsed items JSON | Yes |

### Settlement — computed from expenses, no separate DB collection
| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|---------------|
| GET | `/api/groups/:id/settlement` | Run debt simplification algorithm, return who pays whom | Yes |

---

## Feature Specifications

### 1. Authentication

- Register with name, email, password
- Password hashed with bcrypt (salt rounds: 10)
- On login: return a short-lived access token (15min) and a long-lived refresh token (7 days)
- Store refresh token in an httpOnly cookie — not localStorage
- Store access token in memory (React Context) — not localStorage
- Axios interceptor: on 401 response, automatically call `/api/auth/refresh`, get new access token, retry original request
- Protected routes redirect to `/login` if no valid token

### 2. Groups

- User can create multiple groups (e.g. "Goa Trip", "Flat Expenses", "Office Lunch")
- Each group has a unique invite link: `yourdomain.com/join/:inviteToken`
- Guest users (not logged in) who click invite link are prompted to register/login first, then auto-joined
- Group detail page shows: member list, expense list, total group spend, each member's net balance (positive = owed money, negative = owes money)

### 3. Manual Expense Entry

Form fields:
- Description (text)
- Total amount (number)
- Paid by (dropdown — group members)
- Split type: equal split OR custom amounts per member
- Category (food / travel / accommodation / entertainment / utilities / other)

On equal split: divide total evenly among all selected members.
On custom split: user enters exact amount per person — validate that splits sum to total.

### 4. Bill Photo Parsing (Gemini Vision)

Flow:
1. User clicks "Upload Bill Photo" button in the expense form
2. Image is selected and previewed in the UI
3. On confirm, React sends `POST /api/bills/parse` as multipart/form-data
4. Express receives image via Multer (memory storage), converts buffer to base64
5. Sends to Gemini Vision with this exact prompt:

```
Extract all line items from this restaurant/shop bill.
Return ONLY valid JSON with no extra text, markdown, or explanation.
Format:
{
  "items": [
    { "name": "Item name", "price": 150 },
    { "name": "Another item", "price": 80 }
  ],
  "subtotal": 230,
  "tax": 20,
  "total": 250
}
If you cannot read the bill clearly, return: { "error": "Could not parse bill" }
```

6. Parse the JSON response, strip any ```json fences
7. Return items array to frontend
8. Display items as a list — each item has a dropdown to assign it to a group member
9. Once all items assigned, auto-calculate each person's total and pre-fill the expense form splits

### 5. Debt Simplification Algorithm

Location: `server/utils/debtSimplification.js`

This is the core algorithmic feature. Implement the **minimum cash flow** algorithm:

```js
// Input: array of expenses with splits
// Output: minimum list of transactions to settle all debts

function simplifyDebts(expenses) {
  // Step 1: Build a net balance map { userId: netAmount }
  // Positive = person is owed money (creditor)
  // Negative = person owes money (debtor)
  const balance = {}

  expenses.forEach(expense => {
    // Person who paid gets credited
    balance[expense.paidBy] = (balance[expense.paidBy] || 0) + expense.totalAmount
    // Each person in splits gets debited their share
    expense.splits.forEach(split => {
      balance[split.user] = (balance[split.user] || 0) - split.amount
    })
  })

  // Step 2: Separate into creditors and debtors
  const creditors = [] // people owed money
  const debtors = []   // people who owe money

  Object.entries(balance).forEach(([userId, amount]) => {
    if (amount > 0.01) creditors.push({ userId, amount })
    else if (amount < -0.01) debtors.push({ userId, amount: -amount })
  })

  // Step 3: Greedy matching — largest creditor with largest debtor
  const transactions = []
  let i = 0, j = 0

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  while (i < creditors.length && j < debtors.length) {
    const settle = Math.min(creditors[i].amount, debtors[j].amount)
    transactions.push({
      from: debtors[j].userId,
      to: creditors[i].userId,
      amount: Math.round(settle * 100) / 100  // round to 2 decimal places
    })
    creditors[i].amount -= settle
    debtors[j].amount -= settle
    if (creditors[i].amount < 0.01) i++
    if (debtors[j].amount < 0.01) j++
  }

  return transactions
  // Result: minimum number of payments to settle all debts
}
```

### 6. Real-time Item Assignment (Socket.io)

When multiple group members open the same group page, they join a Socket.io room for that group.

Events:
```
// Client emits when assigning a bill item to themselves:
socket.emit('assign-item', { expenseId, itemIndex, userId, groupId })

// Server broadcasts to all room members:
socket.to(groupId).emit('item-assigned', { expenseId, itemIndex, userId })

// Client emits when joining group page:
socket.emit('join-group', { groupId })

// Server confirms:
socket.emit('joined-group', { groupId, activeMembers: count })
```

Use case: when splitting a restaurant bill, everyone at the table opens the group on their phone and taps the items they ordered in real-time.

### 7. Settlement Summary Page

Route: `/groups/:id/settlement`

Display:
- List of transactions from the debt simplification algorithm
- Format: "[Name] pays [Name] ₹[amount]"
- Group total spend
- Each member's total contribution vs their fair share
- Option to mark individual debts as settled (updates the split.settled field)

---

## Code Standards

- Use `async/await` throughout — no `.then()` chains
- All Express routes wrapped in try/catch — use a central error handler middleware
- Mongoose models use timestamps: `{ timestamps: true }` option
- Never expose passwords in API responses — use `.select('-password')` on User queries
- All monetary values stored in rupees as integers (paise precision not needed)
- Socket.io room name = group MongoDB `_id` as string
- Comment non-obvious logic — especially the debt algorithm and Gemini Vision prompt
- Use named exports for utilities, default exports for React components
- React components use functional style with hooks only — no class components

---

## Build Order (follow this sequence)

Build features in this exact order — each phase is independently testable:

**Phase 1 — Backend foundation**
1. `server.js` setup with Express, CORS, cookie-parser, dotenv
2. MongoDB connection in `config/db.js`
3. User model + auth routes (register, login, refresh, logout, /me)
4. JWT middleware
5. Test auth with Postman before moving on

**Phase 2 — Groups**
6. Group model
7. Group CRUD routes (create, get all, get by id)
8. Invite token generation + join via token route
9. Test group creation and joining

**Phase 3 — Expenses**
10. Expense model
11. Manual expense creation with equal + custom split
12. Expense list per group
13. Balance calculation per member (sum of what they paid minus sum of their splits)

**Phase 4 — Debt Algorithm**
14. `debtSimplification.js` utility
15. `GET /api/groups/:id/settlement` route
16. Test with sample data — verify minimum transactions are correct

**Phase 5 — Gemini Vision**
17. Install `@google/generative-ai` and `multer`
18. `POST /api/bills/parse` route
19. Test with a real bill photo via Postman
20. Tune the prompt until JSON parsing is reliable

**Phase 6 — React Frontend**
21. Vite + React setup, Tailwind, React Router
22. Auth pages + AuthContext + Axios interceptors
23. Dashboard + Group list
24. Group detail page with expense list
25. Manual expense form
26. Bill upload + parsed item assignment UI
27. Settlement summary page

**Phase 7 — Socket.io**
28. Socket.io server setup in `server.js`
29. `socket/handlers.js` — join-group, assign-item events
30. `SocketContext.jsx` on frontend
31. Real-time item assignment in the bill parsing UI

**Phase 8 — Polish + Deploy**
32. Error boundaries in React
33. Loading states on all async operations
34. Mobile responsive layout
35. Deploy backend to Render, frontend to Vercel
36. Add environment variables in Render dashboard
37. Test full flow on production

---

## Key Implementation Notes for Cursor

- When generating the Gemini Vision route, always use `multer.memoryStorage()` — never write files to disk on the server
- The Gemini response must be cleaned with `.replace(/```json|```/g, '').trim()` before `JSON.parse()` — Gemini sometimes wraps JSON in markdown code fences
- Socket.io on Render requires setting `transports: ['websocket', 'polling']` on the client — Render's free tier supports WebSockets
- For CORS with credentials (cookies), set `credentials: true` and `origin: process.env.CLIENT_URL` explicitly — `origin: '*'` breaks cookie sending
- The invite token should be generated with `crypto.randomBytes(32).toString('hex')` — not JWT
- When calculating balances, always round to 2 decimal places to avoid floating point drift across multiple expenses
- Use `populate('members.user', 'name email avatar')` when fetching group details — never return raw ObjectIds to the frontend
- On the React side, store the access token in a ref or context state — not localStorage — to prevent XSS exposure
