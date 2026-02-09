import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/table'
import { Toast, ToastTitle, ToastDescription, ToastClose } from './components/ui/toast'
import { Users, DollarSign, RefreshCw, CheckCircle } from 'lucide-react'

const GHL_WEBHOOK_URL = import.meta.env.VITE_GHL_WEBHOOK_URL

function App() {
  // Affiliate detection
  const [affiliateId, setAffiliateId] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [vaName, setVaName] = useState('')
  const [hireType, setHireType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Table state
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  // Toast state
  const [toast, setToast] = useState({ open: false, title: '', description: '' })

  // Capture affiliate ID from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const amId = params.get('am_id')
    if (amId) {
      setAffiliateId(amId)
      localStorage.setItem('am_id', amId)
    } else {
      // No am_id in URL = direct visit, no affiliate
      setAffiliateId('')
      localStorage.removeItem('am_id')
    }
  }, [])

  // Fetch clients from Supabase
  const fetchClients = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      showToast('Error', 'Failed to fetch clients: ' + error.message)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  function showToast(title, description) {
    setToast({ open: true, title, description })
    setTimeout(() => setToast(prev => ({ ...prev, open: false })), 3000)
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault()
    if (!name || !email || !vaName || !hireType) {
      showToast('Validation Error', 'Please fill in all fields.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('clients').insert([
      {
        name,
        email,
        va_name: vaName,
        hire_type: hireType,
        affiliate_id: affiliateId || null,
        is_paid: false,
      },
    ])

    if (error) {
      showToast('Error', 'Failed to register: ' + error.message)
    } else {
      showToast('Success', 'Client registered successfully!')
      setName('')
      setEmail('')
      setVaName('')
      setHireType('')
      fetchClients()
    }
    setSubmitting(false)
  }

  // Trigger payout
  async function handleTriggerPayout(client) {
    const payoutAmount = client.hire_type === 'Part-Time' ? 150 : 300

    // Update Supabase record
    const { error } = await supabase
      .from('clients')
      .update({ is_paid: true })
      .eq('id', client.id)

    if (error) {
      showToast('Error', 'Failed to update payout status: ' + error.message)
      return
    }

    // Send GHL Webhook
    try {
      await fetch(GHL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: client.email,
          payout_amount: payoutAmount,
        }),
      })
    } catch {
      // Webhook may fail if URL not set yet - that's OK
      console.warn('GHL Webhook call failed. Make sure GHL_WEBHOOK_URL is set.')
    }

    showToast('Payout Triggered', `$${payoutAmount} payout triggered for ${client.name}`)
    fetchClients()
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">VA Recruitment Testing Tool</h1>
            <p className="text-sm text-muted-foreground">
              Track affiliate referrals and manage GHL payouts
              {affiliateId && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Affiliate: {affiliateId}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Register New Client</CardTitle>
            <CardDescription>Fill out the form to register a new VA client referral.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>VA Selection</Label>
                <Select value={vaName} onValueChange={setVaName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a VA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VA Alpha">VA Alpha</SelectItem>
                    <SelectItem value="VA Beta">VA Beta</SelectItem>
                    <SelectItem value="VA Gamma">VA Gamma</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Hire Type</Label>
                <Select value={hireType} onValueChange={setHireType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hire type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Part-Time">Part-Time ($150)</SelectItem>
                    <SelectItem value="Full-Time">Full-Time ($300)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? 'Registering...' : 'Register Client'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Admin Table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Client Dashboard</CardTitle>
              <CardDescription>View all registered clients and manage payouts.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchClients} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>VA</TableHead>
                  <TableHead>Hire Type</TableHead>
                  <TableHead>Affiliate ID</TableHead>
                  <TableHead>Payout Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No clients registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.va_name}</TableCell>
                      <TableCell>{client.hire_type}</TableCell>
                      <TableCell>
                        {client.affiliate_id ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                            {client.affiliate_id}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.affiliate_id ? (
                          client.is_paid ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                              <CheckCircle className="h-4 w-4" /> Paid
                            </span>
                          ) : (
                            <span className="text-yellow-600 text-sm font-medium">Pending</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.affiliate_id ? (
                          <Button
                            size="sm"
                            variant={client.is_paid ? 'outline' : 'default'}
                            disabled={client.is_paid}
                            onClick={() => handleTriggerPayout(client)}
                          >
                            <DollarSign className="h-4 w-4" />
                            {client.is_paid ? 'Paid' : 'Trigger Payout'}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Toast */}
      <Toast open={toast.open} onOpenChange={(open) => setToast(prev => ({ ...prev, open }))}>
        <div className="grid gap-1">
          <ToastTitle>{toast.title}</ToastTitle>
          <ToastDescription>{toast.description}</ToastDescription>
        </div>
        <ToastClose />
      </Toast>
    </div>
  )
}

export default App
