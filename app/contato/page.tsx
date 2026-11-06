'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle, Copy, Check, AlertCircle, Clock } from 'lucide-react';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG } from '@/lib/site-config';

export default function ContatoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Sugestão de Pauta');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successProtocol, setSuccessProtocol] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side quick checks
    if (name.trim().length < 2) {
      setError('O nome informado deve ter pelo menos 2 caracteres.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (message.trim().length < 10) {
      setError('A mensagem deve conter pelo menos 10 caracteres detalhando a solicitação.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao registrar manifestação');
      }

      setSuccessProtocol(data.protocol);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na comunicação com o servidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyProtocol = () => {
    if (successProtocol && typeof window !== 'undefined') {
      navigator.clipboard.writeText(successProtocol);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-12">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1">
            Central de Atendimento
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Fale com a Redação do Norma Jurídica
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">
            Envie sugestões de pauta, pedidos de correção editorial, manifestações da ouvidoria ou contate nossa equipe comercial.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Contact Info Sidebar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight pb-3 border-b border-slate-100 dark:border-zinc-800">
                Informações Institucionais
              </h2>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-zinc-100 font-bold">
                      Sede Oficial
                    </strong>
                    <span className="text-slate-500 dark:text-zinc-400">
                      {SITE_CONFIG.institutional.responsible}<br />
                      {SITE_CONFIG.institutional.address}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-zinc-100 font-bold">
                      Telefone & WhatsApp
                    </strong>
                    <span className="text-slate-500 dark:text-zinc-400">
                      {SITE_CONFIG.institutional.phone}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-zinc-100 font-bold">
                      E-mail Institucional
                    </strong>
                    <span className="text-slate-500 dark:text-zinc-400">
                      {SITE_CONFIG.institutional.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-zinc-100 font-bold">
                      Horário de Funcionamento
                    </strong>
                    <span className="text-slate-500 dark:text-zinc-400">
                      Plantão Editorial: 24 horas<br />
                      Atendimento Comercial: Segunda a sexta, das 8h às 18h
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Contact Form */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            {successProtocol ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100">
                  Manifestação Registrada com Sucesso!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto">
                  Sua demanda foi recebida pela equipe do Norma Jurídica e encaminhada aos editores competentes.
                </p>

                <div className="p-4 bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 rounded-2xl max-w-sm mx-auto">
                  <span className="text-xs font-bold text-brand-800 dark:text-brand-300 block mb-1">
                    Número Oficial de Protocolo:
                  </span>
                  <div className="text-2xl font-black text-brand-700 dark:text-brand-400 tracking-wider font-mono">
                    {successProtocol}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyProtocol}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado para a área de transferência' : 'Copiar Protocolo'}</span>
                  </button>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Por favor, anote ou salve este número para acompanhamento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSuccessProtocol(null)}
                  className="mt-4 text-xs font-bold text-brand-700 hover:underline"
                >
                  Enviar outra mensagem
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome ou razão social"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    E-mail para Retorno *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com.br"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Assunto da Manifestação *
                  </label>
                  <select
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Sugestão de Pauta">Sugestão de Pauta</option>
                    <option value="Correção Editorial">Correção Editorial</option>
                    <option value="Comercial e Anúncios">Comercial e Anúncios</option>
                    <option value="Privacidade e Dados">Privacidade e Dados Pessoais (LGPD)</option>
                    <option value="Elogio ou Crítica">Elogio ou Crítica</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Mensagem Detalhada *
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva com clareza o teor da sua mensagem, mencionando fatos, links ou anexos pertinentes..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Mínimo de 10 caracteres.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Transmitindo manifestação...' : 'Enviar Mensagem e Gerar Protocolo'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
