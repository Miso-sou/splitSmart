/**
 * Minimum Cash Flow Algorithm
 *
 * Takes an array of expenses and returns the minimum list of
 * transactions needed to settle all debts.
 *
 * How it works (3 phases):
 *   Phase A — Build a net balance for each person across all expenses
 *   Phase B — Separate people into creditors (owed money) and debtors (owe money)
 *   Phase C — Greedily match largest debtor to largest creditor until all settled
 *
 * @param {Array} expenses - Array of expense documents (must have paidBy, totalAmount, splits)
 * @returns {Array} transactions - Array of { from, to, amount }
 */

export const simplifyDebts = (expenses) => {
    // -- Phase A: Build net balance map --
    // Net balance = (total a person paid) - (total a person owes)
    // Positive = creditor (owed money), Negative = debtor (owes money)
    const balance = {}

    expenses.forEach(expense => {
        const payerId = expense.paidBy.toString()

        balance[payerId] = (balance[payerId] || 0) + expense.totalAmount

        expense.splits.forEach(split => {
            const userId = split.user.toString()
            balance[userId] = (balance[userId] || 0) - split.amount
        })
    })

    // -- Phase B: Separate into creditors and debtors --
    const creditors = []
    const debtors = []

    Object.entries(balance).forEach(([userId, amount]) => {
        const roundedAmount = Math.round(amount * 100) / 100;
        if (roundedAmount > 0.015) {
            creditors.push({ userId, amount: roundedAmount });
        } else if (roundedAmount < -0.015) {
            debtors.push({ userId, amount: -roundedAmount });
        }
    });

    // sort both array in desc. - for greedy matching
    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    // -- Phase C: Greedy matching --
    // Match largest debtor with largest creditor, settle the smaller of the two subtract from both, advance whichever hits zero

    const transactions = []
    let c = 0 // creditor pointer
    let d = 0 // debtor pointer

    while(c < creditors.length && d < debtors.length){
        const settle = Math.min(creditors[c].amount, debtors[d].amount)

        transactions.push({
            from: debtors[d].userId,
            to: creditors[c].userId,
            amount: Math.round(settle * 100) / 100 // round to 2 decimal places
        })

        creditors[c].amount -= settle
        debtors[d].amount -= settle

        // If creditor is fully paid off, move to next credtor
        if(creditors[c].amount < 0.01) c++;
        // If creditor is fully paid off, move to next credtor
        if(debtors[d].amount < 0.01) d++
    }

    return transactions
}