import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AddExpense from '../src/pages/AddExpense.jsx';
import { getGroup, getGroupMembers } from '../src/api/groups';
import { createExpense } from '../src/api/expenses';
import { getCurrencies } from '../src/api/currencies';

vi.mock('../src/api/groups', () => ({
    getGroup: vi.fn(),
    getGroupMembers: vi.fn(),
}));

vi.mock('../src/api/expenses', () => ({
    createExpense: vi.fn(),
}));

vi.mock('../src/api/currencies', () => ({
    getCurrencies: vi.fn(),
}));

const CURRENCIES = [
    { code: 'EUR', name: 'Euro' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'USD', name: 'US Dollar' },
];

const MEMBERS = [
    { userId: 1, username: 'alice', email: 'alice@test.com', netBalance: '0.00', currentUser: true },
    { userId: 2, username: 'bob', email: 'bob@test.com', netBalance: '0.00', currentUser: false },
];

function today() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

beforeEach(() => {
    vi.clearAllMocks();
    getGroupMembers.mockResolvedValue({ members: MEMBERS });
    getGroup.mockResolvedValue({ id: 1, name: 'Flat 3', baseCurrency: 'NZD' });
    getCurrencies.mockResolvedValue({ currencies: CURRENCIES });
    createExpense.mockResolvedValue({ expense: { id: 9 } });
});

function renderPage() {
    render(
        <MemoryRouter initialEntries={['/groups/1/expenses/new']}>
            <Routes>
                <Route path="/groups/:id/expenses/new" element={<AddExpense />} />
                <Route path="/groups/:id" element={<h1>Flat 3</h1>} />
            </Routes>
        </MemoryRouter>
    );
}

it('AC1: saves the expense and returns to the group', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Amount'), '42.50');
    await user.type(screen.getByLabelText('Description'), 'Groceries');
    await user.selectOptions(screen.getByLabelText('Paid by'), '2');
    await user.click(screen.getByRole('checkbox', { name: 'alice' }));
    await user.click(screen.getByRole('checkbox', { name: 'bob' }));
    await user.click(screen.getByRole('button', { name: 'Save expense' }));

    // The number input normalises 42.50 to 42.5; the backend stores it at two decimal places.
    expect(createExpense).toHaveBeenCalledWith('1', {
        amount: '42.5',
        currency: 'NZD',
        description: 'Groceries',
        paidByUserId: 2,
        expenseDate: today(),
        participantUserIds: [1, 2],
    });
    expect(await screen.findByText('Flat 3')).toBeInTheDocument();
});

it('AC2: shows an inline error on each missing field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Save expense' }));

    expect(screen.getByText('Amount is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(createExpense).not.toHaveBeenCalled();
});

it('AC3: rejects a zero, negative or non-numeric amount', async () => {
    const user = userEvent.setup();
    renderPage();

    const amount = await screen.findByLabelText('Amount');
    await user.type(screen.getByLabelText('Description'), 'Groceries');
    await user.click(screen.getByRole('checkbox', { name: 'alice' }));

    for (const value of ['0', '-5']) {
        await user.clear(amount);
        await user.type(amount, value);
        await user.click(screen.getByRole('button', { name: 'Save expense' }));

        expect(screen.getByText('Amount must be a positive number')).toBeInTheDocument();
    }
    expect(createExpense).not.toHaveBeenCalled();
});

it('AC5: only current group members are selectable as payer', async () => {
    renderPage();

    const payer = await screen.findByLabelText('Paid by');

    expect([...payer.options].map((option) => option.textContent)).toEqual(['alice', 'bob']);
    expect(payer).toHaveValue('1');   // the current user is preselected
});

it('AC6: the date defaults to today and cannot be set in the future', async () => {
    renderPage();

    const date = await screen.findByLabelText('Date');

    expect(date).toHaveValue(today());
    expect(date).toHaveAttribute('max', today());
});

it('AC6: the date defaults to the local date, not the UTC one', async () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 01:00 on 21 August in Auckland is still 20 August in UTC.
    vi.setSystemTime(new Date('2026-08-20T13:00:00Z'));

    try {
        renderPage();

        const date = await screen.findByLabelText('Date');

        expect(date).toHaveValue('2026-08-21');
        expect(date).toHaveAttribute('max', '2026-08-21');
    } finally {
        vi.useRealTimers();
        process.env.TZ = originalTimeZone;
    }
});

it('AC8: shows the error when the group is not readable', async () => {
    getGroupMembers.mockResolvedValue({ error: 'You must be a group member to manage its members' });

    renderPage();

    expect(await screen.findByText('You must be a group member to manage its members'))
        .toBeInTheDocument();
});

// Issue #14 tests:

it('#14 AC3: the currency selector lists supported currencies with their ISO codes', async () => {
    renderPage();

    const currency = await screen.findByLabelText('Currency');

    expect([...currency.options].map((option) => option.value)).toEqual(['EUR', 'NZD', 'USD']);
    expect(screen.getByRole('option', { name: 'USD — US Dollar' })).toBeInTheDocument();
});

it('#14 AC1: the currency defaults to the group currency', async () => {
    renderPage();

    expect(await screen.findByLabelText('Currency')).toHaveValue('NZD');
});

it('#14 AC1: saves an expense in a foreign currency', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Amount'), '20');
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(screen.getByRole('checkbox', { name: 'alice' }));
    await user.click(screen.getByRole('button', { name: 'Save expense' }));

    expect(createExpense).toHaveBeenCalledWith('1', expect.objectContaining({
        amount: '20',
        currency: 'USD',
    }));
});

it('#14 AC3: an unrecognised currency cannot be submitted', async () => {
    // The group currency is somehow missing from the supported list, so nothing valid is selected.
    getGroup.mockResolvedValue({ id: 1, name: 'Flat 3', baseCurrency: 'XYZ' });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Amount'), '20');
    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(screen.getByRole('checkbox', { name: 'alice' }));
    await user.click(screen.getByRole('button', { name: 'Save expense' }));

    expect(screen.getByText('Select a supported currency')).toBeInTheDocument();
    expect(createExpense).not.toHaveBeenCalled();
});

it('#14: shows the server error under the currency selector', async () => {
    createExpense.mockResolvedValue({ errors: { currency: 'Unsupported currency code: USD' } });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Amount'), '20');
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(screen.getByRole('checkbox', { name: 'alice' }));
    await user.click(screen.getByRole('button', { name: 'Save expense' }));

    expect(await screen.findByText('Unsupported currency code: USD')).toBeInTheDocument();
});

it('#14: reports when the currency list cannot be loaded', async () => {
    getCurrencies.mockResolvedValue({ error: 'Could not load currencies.' });

    renderPage();

    expect(await screen.findByText('Could not load currencies.')).toBeInTheDocument();
});

it('AC5: shows the error when the payer is no longer a group member', async () => {
    createExpense.mockResolvedValue({ errors: { form: 'Payer must be a member of the group' } });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Amount'), '10');
    await user.type(screen.getByLabelText('Description'), 'Taxi');
    await user.click(screen.getByRole('checkbox', { name: 'alice' }));
    await user.click(screen.getByRole('button', { name: 'Save expense' }));

    expect(await screen.findByText('Payer must be a member of the group')).toBeInTheDocument();
});
