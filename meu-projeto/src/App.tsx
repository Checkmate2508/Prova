import { useEffect, useRef, useState } from 'react'
import { bookingsOnDate, cancelBooking, createInitialBookings, endTime, formatDate, formatDuration, formatTime, getStatus, INITIAL_COURTS, localDate, parseStart, sortBookings, STATUS, validateBooking } from './domain'
import type { Booking, BookingDraft, BookingErrors, BookingStatus, Court, SortOrder } from './domain'
import { readData, STORAGE_KEY, writeData } from './storage'
import type { AppData } from './storage'
import { Icon } from './components/Icon'
import { Dialog } from './components/Dialog'
import { BookingForm } from './components/BookingForm'
import { CancelForm, CourtForm, Rules } from './components/OtherForms'
import './App.css'

type Modal = { type: 'booking'; courtId?: string } | { type: 'cancel'; bookingId: string } | { type: 'court' } | { type: 'rules' } | null

function loadInitialData() {
  try { return { data: readData(), error: '' } } catch {
    return { data: { courts: INITIAL_COURTS, bookings: createInitialBookings() } as AppData, error: 'Não foi possível ler o armazenamento. As alterações ficarão apenas nesta sessão; os dados anteriores não serão sobrescritos.' }
  }
}

function App() {
  const [initial] = useState(loadInitialData)
  const [data, setData] = useState(initial.data)
  const [storageError, setStorageError] = useState(initial.error)
  const persistent = useRef(!initial.error)
  const [page, setPage] = useState<'agenda' | 'courts'>('agenda')
  const [now, setNow] = useState(() => new Date())
  const [date, setDate] = useState(() => localDate(new Date()))
  const [courtFilter, setCourtFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [sort, setSort] = useState<SortOrder>('status')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !persistent.current) return
      try { setData(readData()) } catch {
        persistent.current = false
        setStorageError('Não foi possível sincronizar os dados. As próximas alterações ficarão apenas nesta sessão.')
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function latestData(): AppData {
    if (persistent.current) {
      try { return readData() } catch {
        persistent.current = false
        setStorageError('O armazenamento está indisponível. As alterações ficarão apenas nesta sessão.')
      }
    }
    return data
  }
  function save(next: AppData) {
    if (persistent.current) {
      try { writeData(next) } catch {
        persistent.current = false
        setStorageError('Não foi possível salvar no navegador. As alterações ficarão apenas nesta sessão; mantenha esta página aberta.')
      }
    }
    setData(next)
    setNow(new Date())
  }
  function createBooking(draft: BookingDraft): BookingErrors {
    const latest = latestData()
    const errors = validateBooking(draft, latest.courts, latest.bookings)
    if (Object.keys(errors).length) return errors
    const booking: Booking = {
      id: crypto.randomUUID(), courtId: draft.courtId, customer: draft.customer.trim(),
      startsAt: parseStart(draft.date, draft.time)!.toISOString(), durationMinutes: Number(draft.duration),
      createdAt: new Date().toISOString(), cancellation: null,
    }
    save({ ...latest, bookings: [...latest.bookings, booking] })
    setDate(draft.date)
    setCourtFilter('all')
    setStatusFilter('all')
    setSearch('')
    setPage('agenda')
    setModal(null)
    setToast('Agendamento registrado com sucesso.')
    return {}
  }
  function cancel(id: string, reason: string): string {
    const latest = latestData()
    const booking = latest.bookings.find((item) => item.id === id)
    if (!booking) return 'Este agendamento não foi encontrado. Atualize a página.'
    try {
      const cancelled = cancelBooking(booking, reason)
      save({ ...latest, bookings: latest.bookings.map((item) => item.id === id ? cancelled : item) })
      setModal(null)
      setToast('Agendamento cancelado. O horário está disponível novamente.')
      return ''
    } catch (error) { return error instanceof Error ? error.message : 'Não foi possível cancelar.' }
  }
  function createCourt(court: Omit<Court, 'id'>): string {
    const latest = latestData()
    if (latest.courts.some((item) => item.name.toLocaleLowerCase('pt-BR') === court.name.toLocaleLowerCase('pt-BR'))) return 'Já existe uma quadra com esse nome.'
    save({ ...latest, courts: [...latest.courts, { ...court, id: crypto.randomUUID() }] })
    setModal(null)
    setToast('Quadra cadastrada com sucesso.')
    return ''
  }
  function navigateDate(direction: number) {
    const next = parseStart(date || localDate(now), '12:00') ?? new Date()
    next.setDate(next.getDate() + direction)
    setDate(localDate(next))
  }
  function clearFilters() { setSearch(''); setCourtFilter('all'); setStatusFilter('all') }

  const dayBookings = data.bookings.filter((booking) => !date || bookingsOnDate(booking, date))
  const ongoing = dayBookings.filter((booking) => getStatus(booking, now) === 'ongoing').length
  const scheduled = dayBookings.filter((booking) => getStatus(booking, now) === 'scheduled').length
  const cancelled = dayBookings.filter((booking) => !!booking.cancellation).length
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visibleBookings = sortBookings(dayBookings.filter((booking) => {
    const court = data.courts.find((item) => item.id === booking.courtId)
    return (courtFilter === 'all' || booking.courtId === courtFilter) &&
      (statusFilter === 'all' || getStatus(booking, now) === statusFilter) &&
      (!normalizedSearch || `${court?.name} ${court?.floor} ${court?.sport} ${booking.customer}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
  }), data.courts, sort, now)
  const dateLabel = date ? (parseStart(date, '12:00')?.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '') : 'Todos os períodos'
  const cancelTarget = modal?.type === 'cancel' ? data.bookings.find((booking) => booking.id === modal.bookingId) : undefined
  const hasFilters = !!search || statusFilter !== 'all' || courtFilter !== 'all'

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('agenda') }} aria-label="Arena, início"><span className="brand-symbol"><Icon name="court" size={27} /></span><span>arena<span className="brand-dot">.</span><small>CENTRO ESPORTIVO</small></span></a>
      <div className="nav-label">ESPAÇO DE TRABALHO</div>
      <nav aria-label="Navegação principal">
        <button className={`nav-item ${page === 'agenda' ? 'active' : ''}`} onClick={() => setPage('agenda')} aria-current={page === 'agenda' ? 'page' : undefined}><Icon name="calendar" /><span>Agendamentos</span><Icon name="arrow" size={15} /></button>
        <button className={`nav-item ${page === 'courts' ? 'active' : ''}`} onClick={() => setPage('courts')} aria-current={page === 'courts' ? 'page' : undefined}><Icon name="court" /><span>Quadras</span><span className="nav-count">{data.courts.length}</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Icon name="shield" size={22} /></span><strong>Mais jogo.<br />Menos imprevistos.</strong><p>Uma agenda organizada começa com horários bem definidos.</p><button onClick={() => setModal({ type: 'rules' })}>Conhecer as regras <Icon name="arrow" size={15} /></button></div><div className="profile"><span className="avatar">R</span><div><strong>Recepção</strong><small>Gestão do centro esportivo</small></div><span className="online-dot" aria-label="Sessão local" /></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="header-context"><div className="project-identity"><strong>Agendamento de Quadra Esportiva</strong><span>PP-0CPMR56-1JKKJE6</span></div><div className="breadcrumb">Centro esportivo <span>/</span><strong>{page === 'agenda' ? 'Agendamentos' : 'Quadras'}</strong></div></div><span className="local-indicator"><span />{storageError ? 'Sessão temporária' : 'Armazenamento local'}</span></header>
      <main>
        <div className="page-heading"><div><span className="eyebrow">{page === 'agenda' ? 'ORGANIZE O JOGO' : 'CONHEÇA OS ESPAÇOS'}</span><h1>{page === 'agenda' ? 'Agendamentos' : 'Suas quadras'}</h1><p>{page === 'agenda' ? 'Uma visão clara das quadras, dos horários e do que vem a seguir.' : 'Os espaços do centro esportivo, prontos para a próxima partida.'}</p></div><button className="button primary" onClick={() => setModal({ type: page === 'agenda' ? 'booking' : 'court' })}><Icon name="plus" size={19} />{page === 'agenda' ? 'Novo agendamento' : 'Cadastrar quadra'}</button></div>
        {storageError && <div className="alert warning" role="alert"><Icon name="warning" /><span>{storageError}</span></div>}
        {page === 'agenda' ? <>
          <div className="stats-grid">
            <Stat label="Agendamentos" value={dayBookings.length} detail={date ? 'na data selecionada' : 'em todos os períodos'} icon="calendar" tone="neutral" />
            <Stat label="Em andamento" value={ongoing} detail="acontecendo agora" icon="court" tone="green" />
            <Stat label="Próximos jogos" value={scheduled} detail={date ? 'a iniciar nesta data' : 'reservas a iniciar'} icon="clock" tone="blue" />
            <Stat label="Cancelados" value={cancelled} detail="histórico preservado" icon="close" tone="gray" />
          </div>
          <section className="agenda-panel" aria-labelledby="agenda-title">
            <div className="panel-heading"><div className="panel-title"><span className="panel-icon"><Icon name="calendar" /></span><div><h2 id="agenda-title">Agenda de quadras</h2><p>{dateLabel}</p></div></div><div className="date-controls"><button className="text-button today-button" onClick={() => setDate(localDate(now))}>Hoje</button><div className="date-picker"><button className="icon-button" aria-label="Dia anterior" onClick={() => navigateDate(-1)}><Icon name="arrow" size={16} style={{ transform: 'rotate(180deg)' }} /></button><input type="date" aria-label="Data da agenda; deixe vazia para ver todas" value={date} onChange={(event) => setDate(event.target.value)} /><button className="icon-button" aria-label="Próximo dia" onClick={() => navigateDate(1)}><Icon name="arrow" size={16} /></button></div><button className={`text-button all-dates ${!date ? 'is-active' : ''}`} onClick={() => setDate('')} aria-pressed={!date}>Todas as datas</button></div></div>
            <div className="filter-bar"><div className="search-field"><Icon name="search" size={18} /><input type="search" aria-label="Buscar por quadra, modalidade ou responsável" placeholder="Buscar quadra ou responsável..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filtrar por quadra" value={courtFilter} onChange={(event) => setCourtFilter(event.target.value)}><option value="all">Todas as quadras</option>{data.courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select><select aria-label="Filtrar por situação" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BookingStatus | 'all')}><option value="all">Todas as situações</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div>
            <div className="list-toolbar"><span><strong>{visibleBookings.length}</strong> {visibleBookings.length === 1 ? 'agendamento' : 'agendamentos'}{hasFilters && <button className="clear-button" onClick={clearFilters}>Limpar filtros</button>}</span><label className="sort-control"><Icon name="sort" size={15} /><span>Ordenar por</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} aria-label="Ordenar agendamentos"><option value="status">Situação e prioridade</option><option value="time">Horário de início</option><option value="court">Nome da quadra</option></select></label></div>
            {visibleBookings.length > 0 ? <div className="table-scroll"><table><thead><tr><th scope="col">QUADRA / MODALIDADE</th><th scope="col">HORÁRIO</th><th scope="col">DURAÇÃO</th><th scope="col">SITUAÇÃO</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{visibleBookings.map((booking) => {
              const court = data.courts.find((item) => item.id === booking.courtId)!
              const status = getStatus(booking, now)
              const end = endTime(booking)
              const crossesDay = localDate(new Date(booking.startsAt)) !== localDate(end)
              return <tr key={booking.id} className={status === 'ongoing' ? 'attention-row' : status === 'cancelled' ? 'cancelled-row' : ''}><td><div className="court-cell"><span className={`court-avatar sport-${court.sport === 'Tênis' ? 'tennis' : court.sport === 'Vôlei' ? 'volley' : 'futsal'}`}><Icon name="court" size={21} /></span><div><strong>{court.name}</strong><span>{court.sport} <span className="middot">·</span> {court.floor}</span><span className="customer-name">{booking.customer}</span></div></div></td><td><strong className="time-range">{formatTime(booking.startsAt)} <span>–</span> {formatTime(end)}{crossesDay && <small> +1 dia</small>}</strong><span className="cell-secondary">{new Date(booking.startsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span></td><td><span className="duration-tag"><Icon name="clock" size={14} />{formatDuration(booking.durationMinutes)}</span></td><td><span className={`status-badge ${status}`}><span />{STATUS[status].label}</span>{status === 'ongoing' && <span className="attention-label"><Icon name="warning" size={14} />Exige aten??o: jogo em andamento</span>}{booking.cancellation && <details className="cancel-details"><summary>Ver motivo</summary><p>{booking.cancellation.reason}</p><small>Cancelado em {formatDate(booking.cancellation.cancelledAt)} às {formatTime(booking.cancellation.cancelledAt)}</small></details>}</td><td className="action-cell">{(status === 'scheduled' || status === 'ongoing') ? <button className="cancel-action" onClick={() => setModal({ type: 'cancel', bookingId: booking.id })} aria-label={`Cancelar reserva de ${booking.customer} em ${court.name} às ${formatTime(booking.startsAt)}`}>Cancelar</button> : <span className="no-action">—</span>}</td></tr>
            })}</tbody></table></div> : <div className="empty-state"><div className="empty-art"><div className="empty-art-back" /><span><Icon name={hasFilters ? 'search' : 'calendar'} size={34} /></span><i><Icon name="check" size={14} /></i></div><h3>{hasFilters ? 'Nenhum resultado por aqui' : 'Espaço livre para o próximo jogo'}</h3><p>{hasFilters ? 'Tente outro termo ou remova os filtros para ver mais agendamentos.' : date ? 'Ainda não há reservas nesta data. Escolha uma quadra e organize a próxima partida.' : 'Sua agenda está pronta. Crie a primeira reserva para começar.'}</p><button className="button secondary" onClick={() => hasFilters ? clearFilters() : setModal({ type: 'booking' })}>{hasFilters ? 'Limpar filtros' : <><Icon name="plus" size={17} />Criar agendamento</>}</button></div>}
            <div className="priority-note"><Icon name="info" size={16} /><span>{sort === 'status' ? 'Prioridade: em andamento → agendados → concluídos → cancelados. Próximos por horário; concluídos mais recentes primeiro.' : sort === 'time' ? 'Agendamentos do início mais antigo ao mais recente, incluindo cancelados.' : 'Quadras em ordem alfabética e numérica; dentro de cada quadra, por horário de início.'}</span></div>
          </section>
          <div className="bottom-grid"><section className="courts-preview"><div className="section-heading"><h2>Por dentro das quadras</h2><button className="text-button" onClick={() => setPage('courts')}>Ver quadras <Icon name="arrow" size={14} /></button></div><div className="mini-courts">{data.courts.slice(0, 3).map((court) => { const inUse = data.bookings.some((booking) => booking.courtId === court.id && getStatus(booking, now) === 'ongoing'); return <button className="mini-court" key={court.id} onClick={() => { setCourtFilter(court.id); setStatusFilter('all'); setSearch('') }}><span className="mini-court-top"><Icon name="court" size={22} /><span className={`availability-dot ${inUse ? 'busy' : ''}`} /></span><strong>{court.name}</strong><span>{court.sport} · {court.floor}</span><small>{inUse ? 'Em uso agora' : 'Livre agora'}</small></button> })}</div></section><section className="limit-card"><div className="limit-card-top"><span className="eyebrow">TEMPO BEM DEFINIDO</span><Icon name="clock" size={21} /></div><div className="limit-number">8<span>horas</span><span className="limit-pill">limite por reserva</span></div><p>A duração é obrigatória e limitada a <strong>480 minutos</strong>. Assim, cada reserva tem início e fim definidos.</p><button className="text-button" onClick={() => setModal({ type: 'rules' })}>Entenda as regras <Icon name="arrow" size={15} /></button></section></div>
        </> : <section className="courts-section" aria-label="Quadras cadastradas"><div className="section-heading"><p><strong>{data.courts.length} quadras</strong> cadastradas no centro esportivo</p><span className="subtle">Disponibilidade neste momento</span></div><div className="court-card-grid">{data.courts.map((court, index) => {
          const inUse = data.bookings.some((booking) => booking.courtId === court.id && getStatus(booking, now) === 'ongoing')
          const upcoming = data.bookings.filter((booking) => booking.courtId === court.id && getStatus(booking, now) === 'scheduled').sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
          return <article className="court-card" key={court.id}><div className={`court-illustration court-color-${index % 3}`}><span className="court-lines"><i /><b /><em /></span><span className="court-number">{String(index + 1).padStart(2, '0')}</span><span className={`status-badge ${inUse ? 'ongoing' : 'available'}`}><span />{inUse ? 'Em uso agora' : 'Livre agora'}</span></div><div className="court-card-body"><h2>{court.name}</h2><p>{court.sport} <span className="middot">·</span> Piso {court.floor.toLocaleLowerCase('pt-BR')}</p><div className="next-booking"><Icon name="clock" size={17} /><span>{upcoming ? `Próxima reserva: ${formatDate(upcoming.startsAt)} às ${formatTime(upcoming.startsAt)}` : 'Sem próximas reservas'}</span></div><div className="court-card-actions"><button className="button secondary" onClick={() => { setCourtFilter(court.id); setStatusFilter('all'); setSearch(''); setDate(''); setPage('agenda') }}>Ver agenda</button><button className="button primary" onClick={() => setModal({ type: 'booking', courtId: court.id })}><Icon name="plus" size={16} />Agendar</button></div></div></article>
        })}</div><p className="courts-footnote"><Icon name="info" size={16} />“Livre agora” indica o uso neste momento. A disponibilidade do horário escolhido é verificada ao agendar.</p></section>}
        <footer className="page-footer"><span>arena. <span>Mais espaço para o esporte.</span></span><span>Dados {storageError ? 'temporários nesta sessão' : 'salvos neste navegador'}<span className="footer-dot">·</span>Horários locais</span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><span><Icon name="check" size={18} /></span>{toast}<button className="icon-button" aria-label="Dispensar mensagem" onClick={() => setToast('')}><Icon name="close" size={16} /></button></div>}
    {modal?.type === 'booking' && <Dialog title="Novo agendamento" subtitle="Reserve um espaço para a próxima partida." onClose={() => setModal(null)}><BookingForm courts={data.courts} courtId={modal.courtId ?? (courtFilter === 'all' ? '' : courtFilter)} date={date} onSubmit={createBooking} onClose={() => setModal(null)} /></Dialog>}
    {modal?.type === 'cancel' && cancelTarget && <Dialog title="Cancelar agendamento" subtitle="O horário será liberado e o registro ficará no histórico." onClose={() => setModal(null)}><CancelForm booking={cancelTarget} court={data.courts.find((court) => court.id === cancelTarget.courtId)!} onSubmit={cancel} onClose={() => setModal(null)} /></Dialog>}
    {modal?.type === 'court' && <Dialog title="Cadastrar quadra" subtitle="Adicione um espaço ao centro esportivo." onClose={() => setModal(null)}><CourtForm onSubmit={createCourt} onClose={() => setModal(null)} /></Dialog>}
    {modal?.type === 'rules' && <Dialog title="Uma agenda com regras claras" subtitle="Entenda como os agendamentos são organizados." onClose={() => setModal(null)} wide><Rules onClose={() => setModal(null)} /></Dialog>}
  </div>
}

function Stat({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: 'calendar' | 'court' | 'clock' | 'close'; tone: string }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon name={icon} size={19} /></span></div><strong className="stat-value">{String(value).padStart(2, '0')}</strong><span className="stat-detail">{detail}</span></div>
}

export default App
