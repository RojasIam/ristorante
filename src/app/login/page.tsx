"use client"

import { useState } from "react"
import { useRouter } from "next/navigation" 
import { createClient } from "@/lib/supabase/client" 
import { FaLock, FaUser, FaEye, FaEyeSlash } from "react-icons/fa"; 

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()
  
  // Remove parallax effect logic

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            console.error("Login error:", error.message)
            setError(error.message === "Invalid login credentials" 
                ? "Credenziali non valide" 
                : `Error: ${error.message}`);
            setIsLoading(false)
            return
        }

        router.push("/dashboard")
        
    } catch (err) {
        console.error("Unexpected error:", err)
        setError("Errore imprevisto.")
        setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-100 overflow-hidden font-sans selection:bg-[#0297c2]/20 text-slate-900">
      
      {/* Background Layer - Solid Gray */}
      <div className="absolute inset-0 z-0 bg-slate-100"></div>

      {/* Main Content - Expanded to fit all branding */}
      <div className="relative z-10 w-full max-w-[400px] p-4 flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
        
        {/* Unified Login Container - Clean Card with Subtle Rounding */}
        <div className="w-full bg-white/80 backdrop-blur-md rounded-xl p-8 border border-white shadow-2xl flex flex-col items-center">
            
            {/* Official Brand Logo Display */}
            <div className="relative mb-2 group">
                {/* Dynamic Glow effect using brand color */}
                <div className="absolute inset-0 bg-[#0297c2]/10 blur-[60px] rounded-full animate-pulse-slow"></div>
                
                <div className="relative w-32 h-32 transition-all duration-700 transform group-hover:scale-110 z-10 flex items-center justify-center">
                    <img 
                        src="/logo-gars.webp" 
                        alt="GARS System" 
                        className="w-full h-full object-contain filter drop-shadow-sm"
                    />
                </div>
            </div>

            {/* Branding Typography */}
            <div className="text-center mb-10">
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.4em] font-black">
                    Management <span style={{ color: '#0297c2' }}>Solution</span>
                </p>
                <div className="h-px w-8 bg-gradient-to-r from-transparent via-[#0297c2]/40 to-transparent mx-auto mt-2"></div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm text-center font-medium">
                    {error}
                </div>
            )}

            {/* Modern Form */}
            <form onSubmit={onSubmit} className="w-full space-y-4">
                
                <div className="space-y-3">
                    {/* Email Input */}
                    <div className="group relative transition-all duration-300">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0297c2] transition-colors z-10">
                            <FaUser className="w-3.5 h-3.5" />
                        </div>
                        <input
                            id="email"
                            placeholder="Email Accesso"
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoCapitalize="none"
                            autoComplete="email"
                            disabled={isLoading}
                            className="w-full bg-white border border-slate-200 rounded-lg px-10 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0297c2] focus:ring-4 focus:ring-[#0297c2]/5 transition-all duration-300"
                        />
                    </div>

                    {/* Password Input */}
                    <div className="group relative transition-all duration-300">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0297c2] transition-colors z-10">
                            <FaLock className="w-3.5 h-3.5" />
                        </div>
                        <input
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            disabled={isLoading}
                            className="w-full bg-white border border-slate-200 rounded-lg px-10 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0297c2] focus:ring-4 focus:ring-[#0297c2]/5 transition-all duration-300"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer p-2"
                        >
                            {showPassword ? <FaEyeSlash className="w-3.5 h-3.5" /> : <FaEye className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full h-11 mt-2 rounded-lg bg-[#0297c2] text-white font-bold text-xs tracking-wide shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01] active:scale-[0.98]"
                >
                    <div className="relative flex items-center justify-center gap-2">
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>ACCEDI AL SISTEMA</span>
                                <svg className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </>
                        )}
                    </div>
                </button>
            </form>
        </div>

        {/* Footer Links - Now separate at the bottom */}
        <div className="pt-10 text-center space-y-4 opacity-40 hover:opacity-100 transition-opacity duration-300">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                Sistema Protetto • GARS v1.0
            </p>
        </div>
      </div>
    </div>
  )
}
