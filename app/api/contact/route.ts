import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { SITE_CONFIG } from '@/lib/site-config';
import { generateProtocolNumber } from '@/lib/protocol';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, subject, message } = body;

    // Validations (pt-BR)
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        sanitizePublicData({ error: 'O nome informado deve ter pelo menos 2 caracteres.' }),
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Por favor, informe um endereço de e-mail válido.' }),
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json(
        sanitizePublicData({ error: 'A mensagem deve conter pelo menos 10 caracteres detalhando a solicitação.' }),
        { status: 400 }
      );
    }

    const cleanSubject = subject || 'Contato Geral';
    const { formatted: protocolNumber } = generateProtocolNumber();

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Não identificado';
    const userAgent = req.headers.get('user-agent') || 'Não identificado';
    const dateFormatted = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Send email via nodemailer if SMTP configured
    let emailSent = false;
    if (SITE_CONFIG.smtp.user && SITE_CONFIG.smtp.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: SITE_CONFIG.smtp.host,
          port: SITE_CONFIG.smtp.port,
          secure: SITE_CONFIG.smtp.secure,
          auth: {
            user: SITE_CONFIG.smtp.user,
            pass: SITE_CONFIG.smtp.pass,
          },
        });

        const htmlTemplate = `
          <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
              <div style="background-color: #1d4ed8; padding: 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">NORMA JURÍDICA</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #dbeafe;">Central de Atendimento e Relacionamento com o Leitor</p>
              </div>

              <div style="padding: 24px;">
                <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 5px solid #1d4ed8; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #1e40af; font-weight: bold; display: block;">Protocolo Oficial de Atendimento</span>
                  <strong style="font-size: 22px; color: #1e3a8a; letter-spacing: 1px;">${protocolNumber}</strong>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Guarde este número para consultas futuras junto à redação.</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 120px;"><strong>Remetente:</strong></td>
                    <td style="padding: 8px 0; color: #0f172a;">${name.trim()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;"><strong>E-mail:</strong></td>
                    <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${email.trim()}" style="color: #1d4ed8;">${email.trim()}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;"><strong>Assunto:</strong></td>
                    <td style="padding: 8px 0; color: #0f172a;">${cleanSubject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;"><strong>Data/Hora:</strong></td>
                    <td style="padding: 8px 0; color: #0f172a;">${dateFormatted} (Horário de Brasília)</td>
                  </tr>
                </table>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
                  <strong style="display: block; margin-bottom: 8px; color: #0f172a;">Mensagem Registrada:</strong>
                  ${message.trim().replace(/\n/g, '<br>')}
                </div>

                <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                  IP de Origem: ${clientIp} • Dispositivo: ${userAgent}
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                ${SITE_CONFIG.name} • ${SITE_CONFIG.institutional.address} • Tel: ${SITE_CONFIG.institutional.phone}
              </div>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Norma Jurídica" <${SITE_CONFIG.smtp.user}>`,
          to: SITE_CONFIG.smtp.receiver,
          replyTo: email.trim(),
          subject: `[Protocolo ${protocolNumber}] ${cleanSubject} - Norma Jurídica`,
          html: htmlTemplate,
        });

        emailSent = true;
      } catch (mailErr) {
        console.error('Erro ao enviar e-mail via SMTP:', mailErr);
      }
    }

    return NextResponse.json(
      sanitizePublicData({
        success: true,
        protocol: protocolNumber,
        emailSent,
        message: 'Manifestação registrada com sucesso. Anote o número de protocolo para acompanhamento.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Falha ao registrar contato.';
    return NextResponse.json(
      sanitizePublicData({ error: errorMsg }),
      { status: 500 }
    );
  }
}
