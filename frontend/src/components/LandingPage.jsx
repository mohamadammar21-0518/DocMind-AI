import { useState, useEffect } from 'react'
import { ArrowRight, FileText, MessageSquare, BookOpen, BarChart2, Zap, Shield, Globe } from 'lucide-react'

export default function LandingPage({ onEnter }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#ececec', overflowX: 'hidden' }}>

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 2rem', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="DocMind AI" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.3px' }}>DocMind AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how">How it works</NavLink>
          </div>
          <button onClick={onEnter} style={{
            background: 'white', color: '#0a0a0a',
            border: 'none', borderRadius: '8px',
            padding: '0.45rem 1.1rem', fontWeight: 600,
            fontSize: '0.85rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#e8e8e8'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            Get started <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8rem 1.5rem 4rem', position: 'relative' }}>

        {/* Subtle background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 'min(600px, 100vw)', height: '400px', background: 'radial-gradient(ellipse, rgba(102,126,234,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <img src="/logo.png" alt="DocMind AI" style={{ width: '90px', height: '90px', objectFit: 'contain', marginBottom: '1rem', animation: 'fadeInUp 0.5s ease', filter: 'drop-shadow(0 0 20px rgba(102,126,234,0.3))' }} />

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '0.3rem 0.9rem', fontSize: '0.78rem', color: '#a0a0a0', marginBottom: '2rem', animation: 'fadeInUp 0.5s ease' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#43e97b', boxShadow: '0 0 6px #43e97b' }} />
          Powered by Groq Llama 3 · Free to use
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '1.5rem', animation: 'fadeInUp 0.5s 0.1s ease both', maxWidth: '800px' }}>
          Your documents,<br />
          <span style={{ background: 'linear-gradient(90deg, #667eea, #a78bfa, #f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            finally understood.
          </span>
        </h1>

        {/* Subheadline */}
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#888', maxWidth: '520px', lineHeight: 1.7, marginBottom: '2.5rem', animation: 'fadeInUp 0.5s 0.2s ease both' }}>
          Upload any PDF and instantly chat with it, get summaries, generate study notes, and evaluate answer quality — all powered by AI.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeInUp 0.5s 0.3s ease both' }}>
          <button onClick={onEnter} style={{
            background: 'white', color: '#0a0a0a',
            border: 'none', borderRadius: '10px',
            padding: '0.85rem 2rem', fontWeight: 700,
            fontSize: '0.95rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s', boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e8e8e8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = '' }}>
            Start for free <ArrowRight size={16} />
          </button>
          <a href="#features" style={{
            background: 'transparent', color: '#888',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
            padding: '0.85rem 2rem', fontWeight: 500,
            fontSize: '0.95rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888' }}>
            See how it works
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '3rem', marginTop: '5rem', animation: 'fadeInUp 0.5s 0.4s ease both', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[['100%', 'Free'], ['3', 'AI Models'], ['6', 'Features'], ['∞', 'Documents']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', letterSpacing: '-1px' }}>{v}</div>
              <div style={{ fontSize: '0.75rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* App preview */}
        <div style={{ marginTop: '5rem', width: '100%', maxWidth: '680px', animation: 'fadeInUp 0.6s 0.5s ease both' }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
            {/* Window bar */}
            <div style={{ background: '#1a1a1a', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', color: '#555' }}>DocMind AI</div>
            </div>
            {/* Chat preview */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <ChatPreviewMsg role="user" text="What are the main conclusions of this research paper?" />
              <ChatPreviewMsg role="bot" text="The paper concludes that transformer-based models significantly outperform traditional approaches in document understanding tasks, achieving 94.2% accuracy on the benchmark dataset. The authors recommend fine-tuning on domain-specific data for optimal results." sources={['Page 12', 'Page 15']} />
              <ChatPreviewMsg role="user" text="Summarize the methodology section" />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 700 }}>AI</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.6rem 0.9rem' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#667eea', animation: `bounce-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            </div>
            {/* Input bar */}
            <div style={{ padding: '0.8rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ flex: 1, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.82rem', color: '#555' }}>Ask anything about your document...</div>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowRight size={14} color="white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 2rem' }} />

      {/* Features */}
      <section id="features" style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#667eea', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.8rem' }}>Capabilities</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
              Everything you need to<br />understand any document
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { Icon: MessageSquare, title: 'Conversational Q&A',   desc: 'Ask questions in natural language and get accurate answers with page citations from your document.',       color: '#667eea' },
              { Icon: FileText,      title: 'Smart Summarization',  desc: 'Map-Reduce summarization reads every page and produces a structured overview — not just the first few chunks.', color: '#a78bfa' },
              { Icon: BookOpen,      title: 'Study Notes',          desc: 'Auto-generates structured notes with explanations, examples, key terms, visual overview, and practice questions.', color: '#f093fb' },
              { Icon: Zap,           title: 'Hybrid Search',        desc: 'Combines BM25 keyword search with vector semantic search for maximum retrieval accuracy.',                  color: '#43e97b' },
              { Icon: Shield,        title: 'RAGAS Evaluation',     desc: 'Scores your RAG pipeline on faithfulness, answer relevancy, and context precision automatically.',           color: '#f6d365' },
              { Icon: Globe,         title: 'Multi-PDF Support',    desc: 'Upload multiple PDFs at once and query across all of them with source tracking per document.',               color: '#f5576c' },
            ].map(({ Icon, title, desc, color }, i) => (
              <div key={i} style={{ background: '#0f0f0f', padding: '2rem', transition: 'background 0.2s', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                onMouseLeave={e => e.currentTarget.style.background = '#0f0f0f'}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                  <Icon size={18} color={color} />
                </div>
                <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem', color: 'white' }}>{title}</h3>
                <p style={{ fontSize: '0.83rem', color: '#666', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 2rem' }} />

      {/* How it works */}
      <section id="how" style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#667eea', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.8rem' }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
              Three steps to instant insights
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { n: '01', title: 'Upload your PDF',  desc: 'Drag and drop any PDF — textbooks, research papers, reports, contracts, manuals.' },
              { n: '02', title: 'AI indexes it',    desc: 'Chunks the text, creates embeddings, and stores in a vector database with hybrid search enabled.' },
              { n: '03', title: 'Ask anything',     desc: 'Get accurate answers with page citations, full summaries, study notes, and quality scores.' },
            ].map(({ n, title, desc }, i) => (
              <div key={i} style={{ display: 'flex', gap: '2rem', padding: '2rem 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.08)', letterSpacing: '-2px', flexShrink: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums', minWidth: '60px' }}>{n}</div>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.4rem', color: 'white' }}>{title}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 2rem' }} />

      {/* CTA */}
      <section style={{ padding: '7rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05, marginBottom: '1.2rem' }}>
            Start understanding<br />your documents today.
          </h2>
          <p style={{ color: '#666', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            Free to use. No credit card required. Just your Groq API key.
          </p>
          <button onClick={onEnter} style={{
            background: 'white', color: '#0a0a0a',
            border: 'none', borderRadius: '10px',
            padding: '0.9rem 2.5rem', fontWeight: 700,
            fontSize: '1rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e8e8e8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = '' }}>
            Launch DocMind AI <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="DocMind AI" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '6px' }} />
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#555' }}>DocMind AI</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#444' }}>
          Built with LangChain · ChromaDB · Groq · FastAPI · React
        </div>
      </footer>

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce-dot { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function NavLink({ href, children }) {
  return (
    <a href={href} style={{ color: '#888', textDecoration: 'none', fontSize: '0.85rem', padding: '0.4rem 0.7rem', borderRadius: '6px', transition: 'color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.color = '#ccc'}
      onMouseLeave={e => e.currentTarget.style.color = '#888'}>
      {children}
    </a>
  )
}

function ChatPreviewMsg({ role, text, sources }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: '0.5rem', alignItems: 'flex-end' }}>
      {!isUser && (
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 700 }}>AI</div>
      )}
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: isUser ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#1e1e1e',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#ddd', lineHeight: 1.5,
        }}>{text}</div>
        {sources && (
          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
            {sources.map(s => (
              <span key={s} style={{ background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.2)', color: '#667eea', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.68rem' }}>{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
