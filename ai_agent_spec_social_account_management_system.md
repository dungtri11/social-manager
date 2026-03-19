# AI AGENT EXECUTION PLAN (STEP-BY-STEP)

## Project: Multi-Account Social Media Management System (Safer Automation)

---

# 0. HOW THE AGENT MUST OPERATE

You (AI Agent) must follow STRICT incremental delivery:

- Implement ONLY the current step
- Ensure code runs before moving forward
- Write tests or run instructions for each step
- Keep code modular and production-ready

Each step must output:

1. Folder structure (if changed)
2. Code
3. How to run
4. Expected result

DO NOT skip steps.

---

# PHASE 1 — MVP (FOUNDATION)

## STEP 1 — Project Initialization

### Goal

Create base backend project

### Requirements

- Node.js project
- Use TypeScript
- Use Express or Fastify

### Tasks

1. Initialize project
2. Setup tsconfig
3. Setup basic server
4. Add health check endpoint: /health

### Expected Output

- Server runs on localhost
- GET /health returns OK

---

## STEP 2 — Database Setup

### Goal

Setup PostgreSQL connection

### Requirements

- Use Prisma ORM

### Tasks

1. Install Prisma
2. Define schema:
   - Account
   - Proxy
3. Run migration
4. Connect DB to app

### Expected Output

- Can create/read Account from DB

---

## STEP 3 — Account Module (Core)

### Goal

Implement account management

### Tasks

1. Create Account service
2. API endpoints:
   - POST /accounts
   - GET /accounts
3. Store:
   - cookie
   - user_agent
   - proxy_id

### Rules

- Do NOT store raw password

### Expected Output

- Can create and list accounts

---

## STEP 4 — Proxy Module

### Goal

Manage proxies

### Tasks

1. Create Proxy service
2. API endpoints:
   - POST /proxies
   - GET /proxies
3. Assign proxy to account

### Expected Output

- Each account has proxy assigned

---

## STEP 5 — Playwright Integration (IMPORTANT)

### Goal

Open browser using account session

### Tasks

1. Install Playwright
2. Create automation service
3. Load cookie into browser
4. Open Facebook homepage

### Rules

- headless = false

### Expected Output

- Browser opens with logged-in account

---

## STEP 6 — Basic Action (Like)

### Goal

Execute simple action

### Tasks

1. Navigate to a post URL
2. Click like button
3. Add delay before/after action

### Expected Output

- Post is liked by account

---

# PHASE 2 — SCALING SYSTEM

## STEP 7 — Task Queue

### Goal

Introduce async job system

### Requirements

- Redis + BullMQ

### Tasks

1. Setup Redis connection
2. Create queue: action_queue
3. Add job structure:
   - account_id
   - action_type
   - target_url

### Expected Output

- Can enqueue jobs

---

## STEP 8 — Worker System

### Goal

Execute jobs in background

### Tasks

1. Create worker process
2. Pull job from queue
3. Execute automation

### Rules

- Limit concurrency

### Expected Output

- Worker processes jobs correctly

---

## STEP 9 — Multi-Account Execution

### Goal

Run multiple accounts safely

### Tasks

1. Batch account list
2. Add random delay between accounts
3. Avoid simultaneous execution

### Expected Output

- Multiple accounts perform actions without spike

---

# PHASE 3 — SAFETY & HUMAN SIMULATION

## STEP 10 — Behavior Engine

### Goal

Simulate human behavior

### Tasks

1. Create delay generator
2. Add random scroll behavior
3. Add idle time simulation

### Example

- Delay: random(5s → 300s)

### Expected Output

- Actions appear human-like

---

## STEP 11 — Content Randomization

### Goal

Avoid duplicate comments

### Tasks

1. Create template system
2. Implement spin syntax
3. Randomize output

### Expected Output

- Each comment is unique

---

## STEP 12 — Fingerprint Layer

### Goal

Reduce detection

### Tasks

1. Randomize user-agent
2. Set viewport per account
3. Set timezone

### Expected Output

- Each browser instance looks unique

---

## STEP 13 — Risk Control System

### Goal

Prevent account bans

### Tasks

1. Add daily action limit
2. Track risk_score
3. Stop high-risk accounts

### Expected Output

- System auto-protects accounts

---

# PHASE 4 — CONTROL PANEL

## STEP 14 — Basic UI

### Goal

Simple dashboard

### Tasks

1. List accounts
2. Trigger actions
3. View logs

### Tech

- React (simple)

### Expected Output

- Operator can control system

---

# FINAL RULES FOR AGENT

You MUST:

- Complete steps sequentially
- Ensure each step runs before continuing
- Write clean, testable code
- Log everything

You MUST NOT:

- Skip safety mechanisms
- Execute bulk actions instantly
- Use identical configs for multiple accounts

---

# OPTIONAL IMPROVEMENTS

- Add AI-generated comments
- Add scheduling system
- Add analytics

---


# IDENTITY MANAGER MODULE (ADVANCED)

## 1. OBJECTIVE

Ensure each account operates under a consistent, isolated identity bundle:

* Cookie
* Proxy
* User-Agent
* Fingerprint

Prevent detection by enforcing strict consistency rules.

---

## 2. DATA MODEL (DATABASE)

### Table: identity_profiles

Fields:

* id (uuid)
* account_id (relation)
* user_agent (text)
* proxy_id (relation)
* timezone (string)
* fingerprint_hash (string)
* created_at
* updated_at

---

### Table: cookie_sessions

Fields:

* id (uuid)
* account_id
* cookies (jsonb)
* status (ACTIVE, EXPIRED, CHECKPOINT)
* last_validated_at
* created_at

---

### Table: proxy_usage_logs

Fields:

* id
* proxy_id
* account_id
* used_at
* ip_address

---

### Table: risk_events

Fields:

* id
* account_id
* type (IP_CHANGE, UA_CHANGE, CHECKPOINT, LOGIN_FAIL)
* severity (LOW, MEDIUM, HIGH)
* metadata (json)
* created_at

---

## 3. IDENTITY SERVICE

### Responsibilities

* Assign identity bundle to account
* Validate consistency before execution
* Prevent conflicting configurations

---

### Core Functions

#### createIdentity(account_id)

* assign user_agent from pool
* assign proxy (1:1)
* assign timezone
* generate fingerprint hash

#### getIdentity(account_id)

* return full identity bundle

#### validateIdentity(account_id)

Checks:

* proxy matches previous usage
* user_agent unchanged
* timezone consistent

Return:

* VALID / RISKY / INVALID

---

## 4. RULE ENGINE

### Purpose

Automatically detect risky behavior and stop execution

---

### Rules

#### Rule 1: Proxy Consistency

IF account uses new proxy
THEN log risk_event (HIGH)
AND block execution

---

#### Rule 2: User-Agent Change

IF user_agent != stored user_agent
THEN log risk_event (HIGH)
AND block execution

---

#### Rule 3: Multiple Accounts per Proxy

IF proxy_id used by > 1 active account
THEN log risk_event (MEDIUM)

---

#### Rule 4: Cookie Invalid

IF session invalid
THEN mark cookie status = EXPIRED
AND stop automation

---

#### Rule 5: Rapid IP Change

IF IP changes within short time window
THEN mark HIGH risk

---

## 5. EXECUTION GUARD (CRITICAL)

Before ANY automation task:

1. Load identity
2. Validate identity
3. IF status != VALID → STOP

---

## 6. INTEGRATION WITH WORKER

Worker must:

1. Fetch identity
2. Apply:
   * proxy
   * user_agent
   * cookies
3. Run validation
4. Execute task

---

## 7. AI AGENT TASKS (IMPLEMENTATION)

### STEP A

* Create database schema (Prisma)

### STEP B

* Implement Identity Service

### STEP C

* Implement Rule Engine

### STEP D

* Integrate with Worker

### STEP E

* Add logging for all identity events

---

## 8. SUCCESS CRITERIA

* Each account has unique identity
* No proxy reuse across accounts
* No user-agent changes per account
* Risk events logged correctly
* Automation blocked on high risk

---

END OF EXECUTION PLAN
