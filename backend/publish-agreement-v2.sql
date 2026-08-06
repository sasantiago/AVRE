BEGIN;

-- Desactiva la versión actualmente activa (v1-placeholder u otra).
UPDATE "DiscretionaryAgreement"
SET "isActive" = false
WHERE "isActive" = true;

-- Publica la nueva versión general (sin datos de firma individual) como activa.
INSERT INTO "DiscretionaryAgreement" (id, "tenantId", version, "contentHash", content, "isActive", "publishedAt", "createdAt")
SELECT
  '019fd889-7fa1-7799-8b44-530273780920',
  "tenantId",
  'v2-general',
  'd4bfa4b193a1486f7f2ddabe0df041fd0fa5c5545e133f9f2f540a359524545e',
  $$ACUERDO DE GESTIÓN DISCRECIONAL DE CAPITAL PROPIO
(Mandato de Inversión en Acciones y Divisas entre Partes Vinculadas)

El presente Acuerdo de Gestión Discrecional de Capital Propio (en adelante, el "Acuerdo") rige la relación entre AVRE Capital Group, en carácter de gestor de la operatoria (en adelante, "EL GESTOR"), y cada cliente que destine capital propio a esta gestión (en adelante, "EL MANDANTE"), en conjunto "las Partes", sujeto a las siguientes cláusulas y condiciones.

CONSIDERANDOS

- Que EL MANDANTE es titular de fondos propios que desea destinar a operaciones de trading en acciones, CEDEARs y/o divisas, y busca delegar la ejecución operativa cotidiana en EL GESTOR, conservando en todo momento la titularidad del capital y de la cuenta operativa.
- Que EL GESTOR cuenta con conocimientos, experiencia y disponibilidad para analizar mercados y ejecutar órdenes conforme a los parámetros de riesgo definidos en este Acuerdo.
- Que el presente Acuerdo se circunscribe exclusivamente a la administración del capital propio de EL MANDANTE. EL GESTOR no capta, administra, agrupa ni intermedia fondos de terceros, no realiza oferta pública de servicios de inversión, no publicita ni promueve sus servicios a un público indeterminado, y no cobra ni retiene fondos de clientes distintos de EL MANDANTE.
- Que, en consecuencia, las Partes dejan expresa constancia de que este Acuerdo NO constituye prestación de servicios de intermediación bursátil, corretaje, agencia de negociación, gestión de carteras de terceros ni ninguna otra actividad reservada a entidades autorizadas y registradas ante organismos reguladores equivalentes. Si en el futuro EL GESTOR pretendiera ofrecer estos servicios a personas distintas de EL MANDANTE, deberá previamente obtener las autorizaciones, registros y licencias exigidos por la normativa aplicable.
- Que la ejecución de las operaciones se realizará exclusivamente a través de cuentas de trading abiertas a nombre de EL MANDANTE en brokers, agentes de liquidación y compensación (ALyC) o plataformas debidamente habilitadas y regulados, no teniendo EL GESTOR en ningún momento la tenencia, custodia, titularidad ni facultad de retiro o transferencia final de los fondos.

CLÁUSULAS

1. OBJETO
EL MANDANTE encomienda a EL GESTOR, y este acepta, la gestión discrecional de la operatoria de compraventa de acciones, criptos y/o divisas (instrumentos derivados autorizados) sobre el capital que EL MANDANTE destine a tal fin, dentro de los parámetros de riesgo, instrumentos autorizados y límites establecidos en la Cláusula 3 del presente Acuerdo.

2. CAPITAL ASIGNADO Y TITULARIDAD DE LA CUENTA
EL MANDANTE destinará a la presente gestión el capital que deposite en su cuenta a tal efecto (en adelante, el "Capital Gestionado").
A EL GESTOR se le otorgarán credenciales o permisos de operación en el mercado bursátil. Los retiros de fondos solo podrán ser realizados por EL MANDANTE, o por quien este autorice expresamente y por escrito, conforme a las políticas estructuradas por EL GESTOR.
EL MANDANTE podrá solicitar retiros de las utilidades generadas por el capital únicamente los días viernes posteriores al cierre de cada mes, durante el período de este Acuerdo de gestión.

3. ESTRATEGIAS OPERATIVAS AUTORIZADAS Y PARÁMETROS DE RIESGO
EL GESTOR ejecutará operaciones dentro de los siguientes parámetros, los cuales solo podrán modificarse mediante acuerdo escrito de ambas Partes:

- Instrumentos autorizados: acciones locales y del exterior, pares de divisas (Forex - Acciones) y/o los instrumentos adicionales que se detallen en la política vigente.
- Apalancamiento máximo autorizado: 1:200.
- Exposición máxima por operación: 3% del Capital Gestionado.
- Pérdida máxima diaria/mensual (stop-loss / drawdown máximo): 3%. Alcanzado este límite, EL GESTOR deberá suspender la operatoria y notificar de inmediato a EL MANDANTE.

EL GESTOR se obliga a actuar con la diligencia y prudencia de un buen hombre de negocios, ajustándose estrictamente a los parámetros anteriores. Cualquier operación fuera de estos límites requerirá autorización previa y expresa de EL MANDANTE.

4. OBLIGACIONES DE EL GESTOR

- Operar exclusivamente dentro de los parámetros definidos en la Cláusula 3.
- Actuar de buena fe, con diligencia profesional y en el mejor interés de EL MANDANTE.
- No retirar, transferir ni disponer de los fondos de la cuenta más allá de las operaciones planteadas en el plan de trading autorizado.
- Remitir a EL MANDANTE reportes mensuales de la operatoria conforme a la Cláusula 6.
- Informar sin demora cualquier hecho relevante, pérdida significativa o incidente que afecte al Capital Gestionado.
- Mantener confidencialidad sobre la información de EL MANDANTE conforme a la Cláusula 9.

5. OBLIGACIONES Y DERECHOS DE EL MANDANTE

- Aportar y mantener el Capital Gestionado en la cuenta designada.
- Otorgar a EL GESTOR los permisos de operación necesarios, limitados según la Cláusula 3.
- Abonar los honorarios pactados en la Cláusula 7.
- Tener acceso irrestricto y en cualquier momento a la información, estado de cuenta y movimientos de la cuenta operativa.
- Revocar el mandato en cualquier momento conforme a la Cláusula 10, sin necesidad de expresar causa.

6. INFORMES Y RENDICIÓN DE CUENTAS
EL GESTOR remitirá a EL MANDANTE un reporte de la operatoria con periodicidad mensual, detallando el resultado (ganancia/pérdida) del período, comisiones y costos incurridos, y cumplimiento de los parámetros de riesgo de la Cláusula 3.

7. HONORARIOS
En contraprestación por sus servicios, EL GESTOR percibirá:
Comisión de éxito: 94% sobre las ganancias netas generadas en el período del Acuerdo de gestión (anual), calculada bajo el mecanismo de marca de agua alta ("high-water mark"), de modo que no se cobrará comisión de éxito sobre resultados que solo recuperen pérdidas previas.
Los honorarios se liquidarán y abonarán dentro de los 6 días hábiles posteriores al cierre de cada período de medición, previa conformidad de EL MANDANTE sobre el reporte correspondiente.

8. RIESGOS Y LIMITACIÓN DE RESPONSABILIDAD
EL MANDANTE declara conocer y aceptar que la operatoria en acciones y divisas conlleva riesgos significativos, incluyendo la posibilidad de pérdida parcial o total del Capital Gestionado, y que los resultados pasados no garantizan resultados futuros. EL GESTOR no garantiza rentabilidad ni resultado alguno, y no será responsable por pérdidas derivadas de la volatilidad normal de los mercados, siempre que haya actuado dentro de los parámetros de riesgo pactados en la Cláusula 3 y con la diligencia debida. EL GESTOR sí será responsable por los daños derivados de dolo, negligencia grave, incumplimiento de los límites de riesgo pactados o uso no autorizado de los fondos.

9. CONFIDENCIALIDAD
Las Partes se obligan a mantener confidencial toda información financiera, estratégica y personal a la que accedan con motivo del presente Acuerdo, no pudiendo divulgarla a terceros sin consentimiento previo y por escrito de la otra Parte, salvo requerimiento de autoridad competente.

10. PLAZO Y TERMINACIÓN
El presente Acuerdo tendrá la vigencia informada a EL MANDANTE al momento de su aceptación, renovándose automáticamente por períodos iguales salvo notificación en contrario de cualquiera de las Partes con 30 días de antelación. Cualquiera de las Partes podrá rescindir el presente Acuerdo en cualquier momento, sin necesidad de invocar causa, mediante notificación fehaciente cursada con 90 días de anticipación. Operada la terminación, EL GESTOR deberá cesar toda operación nueva, liquidar o mantener las posiciones abiertas según instrucción de EL MANDANTE, y remitir un reporte final de cierre.

11. CESIÓN
Ninguna de las Partes podrá ceder los derechos u obligaciones emergentes del presente Acuerdo sin el consentimiento previo y por escrito de la otra Parte.

12. LEY APLICABLE Y JURISDICCIÓN
El presente Acuerdo se rige por las leyes del país donde se aplica la inversión. Para cualquier controversia derivada de su interpretación, cumplimiento o terminación, las Partes se someten a la jurisdicción de los tribunales ordinarios de cada país.

15. NOTIFICACIONES
Toda notificación entre las Partes se considerará válida si se cursa a las direcciones de correo electrónico registradas por las Partes en la plataforma AVRE, o a las que posteriormente se comuniquen fehacientemente.

La aceptación de este Acuerdo se formaliza mediante la confirmación electrónica de EL MANDANTE en la plataforma AVRE, con registro de fecha, hora e IP de origen.
$$,
  true,
  now(),
  now()
FROM "DiscretionaryAgreement"
WHERE version = 'v1-placeholder'
LIMIT 1;

COMMIT;
