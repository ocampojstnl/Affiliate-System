import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/table'
import { Toast, ToastTitle, ToastDescription, ToastClose } from './components/ui/toast'
import { Users, RefreshCw, UserCheck, Info, ArrowLeft, Lock } from 'lucide-react'

const GHL_WEBHOOK_URL = '/api/ghl-webhook'

// Read tracking cookies
function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('authenticated') === 'true')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  function handleLogin(e) {
    e.preventDefault()
    if (username === 'affiliateMaster' && password === 'affiliateMaster1521') {
      setIsAuthenticated(true)
      sessionStorage.setItem('authenticated', 'true')
      setLoginError('')
    } else {
      setLoginError('Invalid username or password.')
    }
  }

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

  // Toast state
  const [toast, setToast] = useState({ open: false, title: '', description: '', variant: 'default' })

  // Capture affiliate tracking params from URL and set as cookies (30-day expiry)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const amId = params.get('am_id')
    const amFingerprint = params.get('am_fingerprint')
    const maxAge = 60 * 60 * 24 * 30 // 30 days

    // Force-delete all cookies matching these names across all domains/paths
    function nukeAndSetCookie(name, value) {
      const hostname = window.location.hostname
      const parts = hostname.split('.')
      const domains = ['', hostname]
      for (let i = 1; i < parts.length; i++) {
        domains.push('.' + parts.slice(i - 1).join('.'))
        domains.push(parts.slice(i - 1).join('.'))
      }
      const paths = ['/', '', window.location.pathname]
      domains.forEach(d => {
        paths.forEach(p => {
          const domainStr = d ? `; domain=${d}` : ''
          const pathStr = p ? `; path=${p}` : ''
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${domainStr}${pathStr}`
          document.cookie = `${name}=; max-age=0${domainStr}${pathStr}`
        })
      })
      if (value) {
        document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
      }
    }

    if (amId) {
      setAffiliateId(amId)
      localStorage.setItem('am_id', amId)
      nukeAndSetCookie('am_id', amId)
    } else {
      setAffiliateId('')
      localStorage.removeItem('am_id')
      nukeAndSetCookie('am_id', null)
    }

    if (amFingerprint) {
      nukeAndSetCookie('am_fingerprint', amFingerprint)
    } else {
      nukeAndSetCookie('am_fingerprint', null)
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
      // Notify GHL of new lead so affiliate gets credit
      if (affiliateId) {
        try {
          await fetch(GHL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              name,
              affiliate_id: affiliateId,
              am_id: getCookie('am_id'),
              am_fingerprint: getCookie('am_fingerprint'),
              type: 'sale',
              event: 'new_lead',
            }),
          })
        } catch {
          // Non-blocking — lead is saved in Supabase regardless
        }
      }

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

    showToast('VA Hired', `${client.name} has been marked as VA Hired.`, 'success')
    fetchClients()
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-lg">Login Required</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-600">{loginError}</p>
              )}
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
            <div className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Demo Credentials:</p>
              <p>Username: <code className="rounded bg-background px-1 py-0.5 font-mono">affiliateMaster</code></p>
              <p>Password: <code className="rounded bg-background px-1 py-0.5 font-mono">affiliateMaster1521</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Authenticated: show full admin dashboard
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
                Track affiliate referrals and VA hires
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
                <CardDescription>A complete overview of the VA Recruitment & Affiliate system.</CardDescription>
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
                  <h3 className="font-semibold text-base mb-2">2. Client Registration (Lead)</h3>
                  <p className="text-sm text-muted-foreground">
                    The client fills out the registration form with their name, email, selects a VA (VA Alpha, VA Beta, or VA Gamma),
                    and picks a hire type (Part-Time or Full-Time). The form submission saves their data to the database along with
                    the affiliate ID (if they came via a referral link). A <strong>lead</strong> event is sent to GHL so the affiliate gets credit for the referral.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-base mb-2">3. Admin Confirms VA Hire (Customer)</h3>
                  <p className="text-sm text-muted-foreground">
                    Once a client has actually hired a VA, an admin clicks the <strong>"Confirm VA Hired"</strong> button on the
                    client's row in the dashboard. This marks the client as having completed a hire and sends a <strong>customer</strong> event
                    to GHL, converting the affiliate's lead into a customer.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-base mb-2">4. Status Tracking</h3>
                  <p className="text-sm text-muted-foreground">Each client row shows:</p>
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li><strong>VA Hire Status</strong> — "Pending Hire" or "VA Hired"</li>
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
              <CardDescription>View all registered clients and manage VA hires.</CardDescription>
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
                  <TableHead className="text-right">Actions</TableHead>
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
                        {client.is_hired ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                            <UserCheck className="h-4 w-4" /> VA Hired
                          </span>
                        ) : (
                          <span className="text-yellow-600 text-sm font-medium">Pending Hire</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
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
