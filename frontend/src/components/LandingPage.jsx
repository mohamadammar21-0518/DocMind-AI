export default function LandingPage({ onEnter }) {
  const features = [
    { icon: '🔍', title: 'Hybrid Search', desc: 'BM25 keyword + vector semantic search combined for maximum retrieval accuracy', color: '#667eea' },
    { icon: '🎯', title: 'AI Reranking', desc: 'Cross-encoder reranker picks the most relevant chunks from retrieved results', color: '#f093fb' },
    { icon: '📝', title: 'Smart Summary', desc: 'Map-Reduce summarization reads every page for a complete structured overview', color: '#43e97b' },
    { icon: '🎓', title: 'Study Notes', desc: 'Auto-generates structured notes with examples, key terms, and practice questions', color: '#f6d365' },
    { icon: '📊', title: 'RAGAS Evaluation', desc: 'Scores faithfulness, relevancy, and precision of every answer automatically', color: '#f5576c' },
    { icon: '💬', title: 'Conversational AI', desc: 'Multi-turn chat with memory — ask follow-up questions naturally', color: '#38f9d7' },
  ]

  const steps = [
    { n: '01', title: 'Upload Your PDF', desc: 'Drag & drop any PDF — textbooks, research papers, reports, manuals' },
    { n: '02', title: 'AI Indexes It',   desc: 'Chunks, embeds, and stores in a vector database with hybrid search' },
    { n: '03', title: 'Ask Anything',    desc: 'Get accurate answers with page citations, summaries, and study notes' },
  ]

  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* Animated background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(102,126,234,0.12) 0%, transparent 70%)', top: '-200px', left: '-200px', animation: 'float 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(118,75,162,0.1) 0%, transparent 70%)', bottom: '-150px', right: '-150px', animation: 'float 10s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,147,251,0.08) 0%, transparent 70%)', top: '40%', right: '20%', animation: 'float 6s ease-in-out infinite' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(102,126,234,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(102,126,234,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Navbar */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,8,18,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🧠</span>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '1.2rem', background: 'linear-gradient(135deg,#667eea,#f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DocMind AI</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem', transition: 'color 0.2s' }}>Features</a>
          <a href="#how" style={{ color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>How it works</a>
          <button onClick={onEnter} className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}>Launch App →</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8rem 2rem 4rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.3)', borderRadius: '20px', padding: '0.35rem 1rem', fontSize: '0.78rem', color: 'var(--accent)', marginBottom: '2rem', animation: 'fadeInUp 0.6s ease forwards' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#43e97b', boxShadow: '0 0 6px #43e97b', display: 'inline-block' }} />
          Powered by Groq · LangChain · ChromaDB
        </div>

        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', animation: 'fadeInUp 0.6s 0.1s ease both' }}>
          Chat with your<br />
          <span style={{ background: 'linear-gradient(135deg,#667eea,#f093fb,#f5576c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 200%', animation: 'gradient-shift 4s ease infinite' }}>
            documents
          </span>
          <br />using AI
        </h1>

        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: 1.7, marginBottom: '2.5rem', animation: 'fadeInUp 0.6s 0.2s ease both' }}>
          Upload any PDF and instantly get answers, summaries, study notes, and quality evaluations — powered by advanced RAG with hybrid search and AI reranking.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeInUp 0.6s 0.3s ease both' }}>
          <button onClick={onEnter} className="btn-primary" style={{ padding: '0.9rem 2.5rem', fontSize: '1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🚀 Start for Free
          </button>
          <a href="#features" className="btn-ghost" style={{ padding: '0.9rem 2rem', fontSize: '1rem', borderRadius: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            See Features ↓
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '3rem', marginTop: '4rem', animation: 'fadeInUp 0.6s 0.4s ease both', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[['100%', 'Free to Use'], ['6', 'AI Features'], ['3', 'LLM Models'], ['∞', 'Documents']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: '2rem', fontWeight: 700, background: 'linear-gradient(135deg,#667eea,#f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{v}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Floating preview card */}
        <div style={{ marginTop: '5rem', width: '100%', maxWidth: '700px', animation: 'fadeInUp 0.8s 0.5s ease both' }}>
          <div className="glass animate-pulse-glow" style={{ borderRadius: '20px', padding: '1.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧠</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>DocMind AI</div>
                <div style={{ fontSize: '0.72rem', color: '#43e97b' }}>● Online</div>
              </div>
            </div>
            <div style={{ background: 'rgba(102,126,234,0.08)', borderRadius: '12px', padding: '1rem', marginBottom: '0.8rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Based on the document, <strong style={{ color: 'var(--text-primary)' }}>JavaScript</strong> can be used in three ways: inline scripts, external files without parameters, and external files with parameters. The key difference is code organization — inline mixes HTML and JS, while external files keep them separate for better maintainability.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['Page 1', 'Page 2'].map(p => (
                <span key={p} style={{ background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.3)', color: 'var(--accent)', borderRadius: '20px', padding: '0.2rem 0.7rem', fontSize: '0.72rem' }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ position: 'relative', zIndex: 1, padding: '6rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.8rem' }}>CAPABILITIES</div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700 }}>
              Everything you need to<br /><span className="gradient-text">understand any document</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {features.map((f, i) => (
              <div key={i} className="glass" style={{ padding: '1.8rem', borderRadius: '20px', transition: 'all 0.3s ease', cursor: 'default', animationDelay: `${i * 0.1}s` }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = f.color + '40'; e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.3), 0 0 30px ${f.color}15`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${f.color}15`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ position: 'relative', zIndex: 1, padding: '6rem 2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.8rem' }}>HOW IT WORKS</div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700 }}>
              Three steps to <span className="gradient-text">instant insights</span>
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {steps.map((s, i) => (
              <div key={i} className="glass" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', gap: '2rem', alignItems: 'center', transition: 'all 0.3s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(8px)'; e.currentTarget.style.borderColor = 'rgba(102,126,234,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(135deg,#667eea,#764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', flexShrink: 0, lineHeight: 1 }}>{s.n}</div>
                <div>
                  <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.4rem' }}>{s.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 1, padding: '6rem 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass animate-pulse-glow" style={{ padding: '4rem 3rem', borderRadius: '28px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧠</div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
              Ready to get started?
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7 }}>
              Upload your first PDF and experience AI-powered document intelligence — completely free.
            </p>
            <button onClick={onEnter} className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.05rem', borderRadius: '14px' }}>
              🚀 Launch DocMind AI
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--border)', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, color: 'var(--text-secondary)' }}>🧠 DocMind AI</span>
          {' · '}Built with LangChain · ChromaDB · Groq · FastAPI · React
        </div>
        <div>RAG Pipeline · Hybrid Search · Cross-Encoder Reranking · RAGAS Evaluation</div>
      </footer>
    </div>
  )
}
