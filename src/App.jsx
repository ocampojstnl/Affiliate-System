import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/table'
import { Toast, ToastTitle, ToastDescription, ToastClose } from './components/ui/toast'
import { Users, DollarSign, RefreshCw, CheckCircle, UserCheck, Info, ArrowLeft } from 'lucide-react'

const GHL_WEBHOOK_URL = import.meta.env.VITE_GHL_WEBHOOK_URL

function App() {
  // Page navigation
  const [page, setPage] = useState('dashboard')

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

  // Payout loading state
  const [payingOutId, setPayingOutId] = useState(null)

  // Toast state
  const [toast, setToast] = useState({ open: false, title: '', description: '', variant: 'default' })

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

  // Inject GHL affiliate tracking script
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = 'https://link.esystemsmanagement.com/js/am.js'
    script.onload = script.onreadystatechange = function () {
      const state = this.readyState
      if (!state || state === 'complete' || state === 'loaded') {
        try {
          window.affiliateManager.init(
            'dXPpkZ3hX5PCKayZrLsI',
            'https://backend.leadconnectorhq.com',
            '.affiliate-system-utrz.onrender.com'
          )
        } catch (e) {
          console.warn('GHL affiliate script init failed:', e)
        }
      }
    }
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript.parentNode.insertBefore(script, firstScript)

    return () => {
      script.remove()
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
      showToast('Error', 'Failed to fetch clients: ' + error.message, 'error')
    } else {
      setClients(data || [])
    }
    setLoading(false)
    return { data, error }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  function showToast(title, description, variant = 'default') {
    setToast({ open: true, title, description, variant })
    setTimeout(() => setToast(prev => ({ ...prev, open: false })), 4000)
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault()
    if (!name || !email || !vaName || !hireType) {
      showToast('Validation Error', 'Please fill in all fields.', 'warning')
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
      showToast('Error', 'Failed to register: ' + error.message, 'error')
    } else {
      showToast('Client Registered', `${name} has been registered successfully!`, 'success')
      setName('')
      setEmail('')
      setVaName('')
      setHireType('')
      fetchClients()
    }
    setSubmitting(false)
  }

  // Mark client as hired
  async function handleMarkHired(client) {
    const { error } = await supabase
      .from('clients')
      .update({ is_hired: true })
      .eq('id', client.id)

    if (error) {
      showToast('Error', 'Failed to mark as hired: ' + error.message, 'error')
      return
    }

    showToast('VA Hired', `${client.name} hired a VA. Affiliate payout is now eligible.`, 'success')
    fetchClients()
  }

  // Trigger payout — send GHL webhook first, then update Supabase on success
  async function handleTriggerPayout(client) {
    const payoutAmount = client.hire_type === 'Part-Time' ? 0 : 0
    setPayingOutId(client.id)

    // Send GHL Webhook first
    try {
      const response = await fetch(GHL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: client.email,
          payout_amount: payoutAmount,
          status: 'success',
        }),
      })

      if (!response.ok) {
        showToast('Webhook Error', `GHL webhook returned status ${response.status}. Payout not recorded.`, 'error')
        setPayingOutId(null)
        return
      }
    } catch (err) {
      showToast('Webhook Error', 'Failed to reach GHL webhook. Check your VITE_GHL_WEBHOOK_URL.', 'error')
      setPayingOutId(null)
      return
    }

    // Webhook succeeded — now update Supabase record
    const { error } = await supabase
      .from('clients')
      .update({ is_paid: true })
      .eq('id', client.id)

    if (error) {
      showToast('Error', 'GHL webhook sent but failed to update database: ' + error.message, 'error')
      setPayingOutId(null)
      return
    }

    showToast('Payout Triggered', `$${payoutAmount} payout sent to GHL for ${client.name}'s affiliate.`, 'success')
    setPayingOutId(null)
    fetchClients()
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page === 'dashboard' ? 'how-it-works' : 'dashboard')}
          >
            {page === 'dashboard' ? (
              <><Info className="h-4 w-4" /> How It Works</>
            ) : (
              <><ArrowLeft className="h-4 w-4" /> Back to Dashboard</>
            )}
          </Button>
        </div>

        {page === 'how-it-works' ? (
          <>
            {/* How It Works Page */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
                <CardDescription>A complete overview of the VA Recruitment & Affiliate Payout system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-base mb-2">1. Affiliate Referral Link</h3>
                  <p className="text-sm text-muted-foreground">
                    Affiliates share a unique referral link containing their ID, e.g.
                    <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">yoursite.com?am_id=90899</code>.
                    When a client visits the site through this link, the affiliate ID is automatically captured and stored.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-base mb-2">2. Client Registration</h3>
                  <p className="text-sm text-muted-foreground">
                    The client fills out the registration form with their name, email, selects a VA (VA Alpha, VA Beta, or VA Gamma),
                    and picks a hire type (Part-Time or Full-Time). The form submission saves their data to the database along with
                    the affiliate ID (if they came via a referral link).
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-base mb-2">3. Admin Confirms VA Hire</h3>
                  <p className="text-sm text-muted-foreground">
                    Once a client has actually hired a VA, an admin clicks the <strong>"Confirm VA Hired"</strong> button on the
                    client's row in the dashboard. This marks the client as having completed a hire, which makes the referring
                    affiliate eligible for their payout.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-base mb-2">4. Trigger Affiliate Payout</h3>
                  <p className="text-sm text-muted-foreground">
                    After a VA hire is confirmed, the <strong>"Trigger Payout"</strong> button becomes available. Clicking it
                    sends a webhook to GoHighLevel (GHL) with the client's email and the payout amount:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li><strong>Part-Time hire</strong> = $150 affiliate payout</li>
                    <li><strong>Full-Time hire</strong> = $300 affiliate payout</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    The payout data is sent to GHL, where it appears under the affiliate's "Commissions" in the GHL Affiliate Portal.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-base mb-2">5. Status Tracking</h3>
                  <p className="text-sm text-muted-foreground">Each client row shows two statuses:</p>
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li><strong>VA Hire Status</strong> — "Pending Hire" or "VA Hired"</li>
                    <li><strong>Payout Status</strong> — "Awaiting Hire", "Ready for Payout", or "Paid"</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
        <>
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
            <Button variant="outline" size="sm" onClick={async () => { const res = await fetchClients(); if (!res.error) showToast('Refreshed', 'Client data has been updated.', 'info') }} disabled={loading}>
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
                  <TableHead>VA Hire Status</TableHead>
                  <TableHead>Payout Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                        {client.is_hired ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                            <UserCheck className="h-4 w-4" /> VA Hired
                          </span>
                        ) : (
                          <span className="text-yellow-600 text-sm font-medium">Pending Hire</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.affiliate_id ? (
                          client.is_paid ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                              <CheckCircle className="h-4 w-4" /> Paid
                            </span>
                          ) : client.is_hired ? (
                            <span className="text-blue-600 text-sm font-medium">Ready for Payout</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Awaiting Hire</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!client.is_hired && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkHired(client)}
                            >
                              <UserCheck className="h-4 w-4" />
                              Confirm VA Hired
                            </Button>
                          )}
                          {client.affiliate_id && client.is_hired && (
                            <Button
                              size="sm"
                              variant={client.is_paid ? 'outline' : 'default'}
                              disabled={client.is_paid || payingOutId === client.id}
                              onClick={() => handleTriggerPayout(client)}
                            >
                              {payingOutId === client.id ? (
                                <><RefreshCw className="h-4 w-4 animate-spin" /> Sending...</>
                              ) : (
                                <><DollarSign className="h-4 w-4" /> {client.is_paid ? 'Paid' : 'Trigger Payout'}</>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </>
        )}
      </div>

      {/* Toast */}
      <Toast open={toast.open} variant={toast.variant} onOpenChange={(open) => setToast(prev => ({ ...prev, open }))}>
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
