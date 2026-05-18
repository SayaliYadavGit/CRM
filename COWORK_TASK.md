# Cowork Task Setup — QITT Lead Research Bridge

**For:** Minakshi Shrimalve
**Purpose:** Set up Cowork on your Mac to research pending QITT leads using your Claude Max plan.
**Time to set up:** ~30 minutes the first time. ~5 minutes per batch after that.

---

## What this task does

Every time you run it, Cowork:

1. Fetches the list of pending leads from QITT CRM
2. For each lead, researches the company using web search + Claude reasoning
3. POSTs the research dossier back to QITT CRM
4. CRM writes it into the database, marks the lead as "researched"

Your team adds leads through the CRM web UI any time during the day. The leads
queue up and wait for you to run this Cowork task. When you run it, all pending
leads get researched in one go.

---

## Prerequisites (one-time)

- [ ] Claude Desktop installed on your Mac (latest version)
- [ ] Claude Max plan active (you have this)
- [ ] Cowork enabled in Claude Desktop
- [ ] You have the deployment URL of QITT CRM (will be provided after deploy)
- [ ] You have the `COWORK_BRIDGE_TOKEN` (will be shared securely via 1Password / Signal / similar — never paste in chat or email)

---

## Step 1: Create the Cowork task

1. Open Claude Desktop
2. Click the **Cowork** tab (not Chat)
3. Click **+ New task**
4. Name it: `QITT Lead Research`
5. In the task description / prompt field, paste the entire **Task Prompt** block below (between the triple backticks)
6. Set frequency: **On demand** (you'll run it manually)
7. Save the task

---

## Step 2: Task Prompt (paste this into the Cowork task)