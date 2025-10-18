import React, { useState, useEffect } from 'react';
// UI components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

// Core modules
import { supabase } from '../../utils/supabase/client';
import { useAuth } from '../../App';
import { Layout } from '../Layout';
import {
  DollarSign,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Type definitions for the categorization result
interface CategoryResult {
  category: string;
  source: string;
}

// Adjusted default export to fix potential Layout import conflict, 
// ensuring the main component is exported correctly.
export default function DashboardPageWrapper() { return (<Layout> <Dashboard /></Layout>); }

export function Dashboard() {
  const analyticsInfo = useState<any>(null);
  const isDataLoading = useState(true);

  // FIX 1: Active tab state uses the corrected destructuring

  // const setActiveTab = setCurrentTab; // Not needed as we use setCurrentTab directly

  // FIX 2: Removed incorrect assignment line
  // const setActiveTab = currentTab = useState('overview'); 

  const analyticsData = analyticsInfo[0];
  const setAnalyticsData = analyticsInfo[1];
  const loading = isDataLoading[0];
  const setLoading = isDataLoading[1];

  const { user } = useAuth();

  // --- NEW STATES FOR AI CATEGORIZATION ---
  const [expenseDescription, setExpenseDescription] = useState('');
  // Added state for manual category input (from the previous step)
  const [manualCategory, setManualCategory] = useState('');
  const [categorizing, setCategorizing] = useState(false);
  const [categoryResult, setCategoryResult] = useState<CategoryResult | null>(null);
  const [categorizationError, setCategorizationError] = useState('');

  // Simple data fetching for analytics
  useEffect(() => {
    const getAnalyticsData = async () => {
      if (!user) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // NOTE: Ensure your serverless function is correctly set up for this endpoint
        const response = await fetch(`/api/supabase/proxy/analytics/spending`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setAnalyticsData(data);
        }
      }

      setLoading(false);
    };

    getAnalyticsData();
  }, [user]);

  // --- UPDATED FUNCTION: Handles both Categorization and Learning ---
  const handleCategorize = async (event: React.FormEvent) => {
    event.preventDefault();
    setCategorizing(true);
    setCategoryResult(null);
    setCategorizationError('');

    if (!expenseDescription.trim()) {
      setCategorizationError('Please enter an expense description.');
      setCategorizing(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwtToken = session?.access_token;

      if (!jwtToken) {
        setCategorizationError('Authentication failed. Please log in again.');
        return;
      }

      const isLearning = manualCategory.trim() !== '';

      // Prepare data for x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('description', expenseDescription);

      // Include manual category if provided (this triggers the learning path on the backend)
      if (isLearning) {
        formData.append('category', manualCategory.trim());
      }

      // Fetch call to your local Flask server
      const response = await fetch('http://127.0.0.1:8000/api/categorize', {
        method: 'POST',
        credentials: 'include',  // Added credentials back
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'  // Added Accept header back
        },
        body: formData.toString()
      });

      const result = await response.json();

      if (response.ok) {
        if (isLearning) {
          // Display success message for learning
          setCategoryResult({ category: manualCategory.trim(), source: 'Rule Saved (Manual)' });
        } else {
          // Display category result for automatic categorization
          setCategoryResult({ category: result.category, source: result.source });
        }
        setExpenseDescription(''); // Clear input on success
        setManualCategory(''); // Clear manual category
      } else {
        // Handle HTTP errors returned by Flask
        setCategorizationError(result.error || 'Could not reach categorization service.');
      }
    } catch (err) {
      console.error('Categorization fetch error:', err);
      // This is the error message seen in the screenshot, often caused by path/CORS/server issues.
      setCategorizationError('Network error or server connection failed. Is the Python server running?');
    } finally {
      setCategorizing(false);
    }
  };

  // Simple calculations
  const totalSpending = analyticsData?.total_spending || 0;
  const savingsGoal = 1000;
  const monthlySavings = Math.max(0, savingsGoal - totalSpending);
  const savingsProgress = (monthlySavings / savingsGoal) * 100;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your financial overview.</p>
        </div>
        <div className="flex gap-2">
          {/* Note: This button is for adding the expense manually */}
          <Button asChild>
            <Link to="/add-expense">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary cards (omitted for brevity) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `$${totalSpending.toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-muted-foreground flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                This month's total
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">You Owe</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">$0.00</div>
            <p className="text-xs text-muted-foreground">All settled up!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">You Are Owed</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">$0.00</div>
            <p className="text-xs text-muted-foreground">All settled up!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Savings</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `$${monthlySavings.toFixed(2)}`}
            </div>
            <Progress value={savingsProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {savingsProgress.toFixed(0)}% of ${savingsGoal} goal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* --- NEW AI CATEGORIZATION CARD (Including Learning Input) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-600" />
              Smart Expense Categorization & Learning Tool
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter a description to categorize, or enter a category too to **save a learning rule**.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCategorize} className="space-y-4">
              <input
                type="text"
                placeholder="Expense Description (e.g., Local coffee shop)"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                disabled={categorizing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                type="text"
                placeholder="Optional: Manual Category (e.g., Cafes)"
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                disabled={categorizing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button type="submit" disabled={categorizing}>
                {categorizing
                  ? 'Processing...'
                  : manualCategory.trim()
                    ? `Save Rule: ${manualCategory.trim()}`
                    : 'Auto-Categorize'}
              </Button>
            </form>

            {(categoryResult || categorizationError) && (
              <div className="mt-6 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
                {categorizationError ? (
                  <p className="text-sm font-medium text-red-500">{categorizationError}</p>
                ) : categoryResult ? (
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-indigo-800">
                      Result:
                      <span className="ml-2 text-xl font-bold">{categoryResult.category}</span>
                    </p>
                    <p className="text-xs text-indigo-600">
                      Source:
                      <span className="font-mono ml-1 px-2 py-0.5 bg-indigo-100 rounded">
                        {categoryResult.source === 'user_dictionary' ? 'Rule (Learned)' : categoryResult.source === 'ai' ? 'Gemini AI (New Rule Saved)' : categoryResult.source}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* --- END NEW AI CARD --- */}

    </div>
  );
}
