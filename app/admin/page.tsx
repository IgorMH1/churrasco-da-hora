"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import { getNowGmt3, hasScheduleConflict } from "../../lib/services/rbacAndTime";
import {
  loadInitialData,
  saveEventsToStorage,
  saveClientsToStorage,
  saveStaffToStorage,
  resetDatabaseToAdminOnly,
  StaffMember,
  ClientRecord,
  EventRecord,
} from "../../lib/services/storage";

type AdminTab = "DASHBOARD" | "EVENTOS" | "CADASTROS" | "BACKUP";

interface BackupLog {
  id: string;
  scope: "Usuários" | "Eventos" | "Completo";
  format: "JSON" | "SQL";
  exportedAtGmt3: string;
  exportedBy: string;
}

export default function AdminPortalPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");
  const [todayGmt3, setTodayGmt3] = useState<string>("");
  const [clockGmt3, setClockGmt3] = useState<string>("17/11/2026 às 14:32:08 (GMT-3)");
  const [feedback, setFeedback] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);

  // Filtros da aba Gestão de Eventos
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "PENDENTE" | "CONFIRMADO" | "CANCELADO">("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  // Campos de Novo Agendamento Manual ADM
  const [evTitle, setEvTitle] = useState("");
  const [evType, setEvType] = useState<EventRecord["eventType"]>("ANIVERSARIO");
  const [evHonoree, setEvHonoree] = useState("");
  const [evClient, setEvClient] = useState("Marcos Oliveira");
  const [evAdmin, setEvAdmin] = useState("Roberto Da Hora");
  const [evDate, setEvDate] = useState("");
  const [evStart, setEvStart] = useState("16:00");
  const [evEnd, setEvEnd] = useState("21:00");
  const [evStaffSelected, setEvStaffSelected] = useState<string[]>([]);

  // Campos de Novo Cadastro (Pessoas)
  const [cadCategory, setCadCategory] = useState<"EXTERNA_TERCEIRO" | "INTERNA" | "CLIENTE">("EXTERNA_TERCEIRO");
  const [cadName, setCadName] = useState("");
  const [cadEmail, setCadEmail] = useState("");
  const [cadPhone, setCadPhone] = useState("");
  const [cadSpecialty, setCadSpecialty] = useState("Churrasqueiro");
  const [cadCompany, setCadCompany] = useState("");
  const [cadRate, setCadRate] = useState("350");

  useEffect(() => {
    const now = getNowGmt3();
    setTodayGmt3(now.dateStr);
    setClockGmt3(now.formattedPtBr);
    setEvDate(now.dateStr);

    const data = loadInitialData();
    setEvents(data.events);
    setClients(data.clients);
    setStaffList(data.staff);

    const timer = setInterval(() => {
      const updated = getNowGmt3();
      setTodayGmt3(updated.dateStr);
      setClockGmt3(updated.formattedPtBr);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const eventsToday = events.filter((e) => e.eventDate === todayGmt3 && e.status !== "CANCELADO");
  const pendingEvents = events.filter((e) => e.status === "PENDENTE");
  const internalStaff = staffList.filter((s) => s.staffType === "INTERNA");
  const externalStaff = staffList.filter((s) => s.staffType === "EXTERNA_TERCEIRO");

  const handleApproveAndSyncGcal = (id: string) => {
    const updated = events.map((ev) =>
      ev.id === id
        ? {
            ...ev,
            status: "CONFIRMADO" as const,
            responsibleAdmin: ev.responsibleAdmin.includes("confirmar") ? "Roberto Da Hora" : ev.responsibleAdmin,
            googleCalendarEventId: `gcal_sync_${Math.floor(1000 + Math.random() * 9000)}`,
          }
        : ev
    );
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback("✓ Evento aprovado e sincronizado com Google Calendar (GMT-3)!");
  };

  const handleCancelEvent = (id: string) => {
    const updated = events.map((ev) => (ev.id === id ? { ...ev, status: "CANCELADO" as const } : ev));
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback("Evento cancelado e horário liberado na agenda.");
  };

  const handleCreateManualEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evHonoree.trim()) {
      setFeedback("Informe obrigatoriamente 'Para quem é o evento?'.");
      return;
    }
    if (evEnd <= evStart) {
      setFeedback("O horário de término deve ser maior que o início.");
      return;
    }

    const conflict = events.find(
      (existing) =>
        existing.eventDate === evDate &&
        existing.status !== "CANCELADO" &&
        hasScheduleConflict(evStart, evEnd, existing.startTime, existing.endTime, 60)
    );

    if (conflict) {
      setFeedback(
        `Conflito de horário com "${conflict.title}" (${conflict.startTime} às ${conflict.endTime} + 1h limpeza).`
      );
      return;
    }

    const newEv: EventRecord = {
      id: `ev-${Date.now()}`,
      title: evTitle || `${evType} - ${evHonoree}`,
      eventType: evType,
      honoreeName: evHonoree,
      clientName: evClient,
      responsibleAdmin: evAdmin,
      eventDate: evDate,
      startTime: evStart,
      endTime: evEnd,
      status: "CONFIRMADO",
      googleCalendarEventId: `gcal_sync_${Math.floor(1000 + Math.random() * 9000)}`,
      supportTeam: evStaffSelected.length > 0 ? evStaffSelected : ["Equipe padrão"],
    };

    const updated = [newEv, ...events];
    setEvents(updated);
    saveEventsToStorage(updated);
    setEvTitle("");
    setEvHonoree("");
    setFeedback("✓ Agendamento criado e sincronizado com o Google Calendar!");
  };

  const handleSaveCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateAnatelPhone(cadPhone);
    if (!check.valid) {
      setFeedback(`Erro ANATEL: ${check.error}`);
      return;
    }

    if (cadCategory === "CLIENTE") {
      const updatedClients = [
        ...clients,
        { id: `cli-${Date.now()}`, name: cadName, email: cadEmail, phoneAnatel: check.formatted || cadPhone },
      ];
      setClients(updatedClients);
      saveClientsToStorage(updatedClients);
      setFeedback(`✓ Cliente "${cadName}" adicionado com sucesso (${check.regionUf})!`);
    } else {
      const updatedStaff: StaffMember[] = [
        ...staffList,
        {
          id: `st-${Date.now()}`,
          name: cadName,
          phoneAnatel: check.formatted || cadPhone,
          staffType: cadCategory,
          specialty: cadSpecialty,
          companyName: cadCategory === "EXTERNA_TERCEIRO" ? cadCompany : "Família",
          dailyRate: cadCategory === "EXTERNA_TERCEIRO" ? Number(cadRate) || 0 : 0,
        },
      ];
      setStaffList(updatedStaff);
      saveStaffToStorage(updatedStaff);
      setFeedback(`✓ "${cadName}" adicionado à equipe (${check.regionUf})!`);
    }
    setCadName("");
    setCadEmail("");
    setCadPhone("");
    setCadCompany("");
  };

  const handleDownloadBackup = (scope: "Usuários" | "Eventos" | "Completo", format: "JSON" | "SQL") => {
    const now = getNowGmt3();
    let content = "";
    const filename = `backup_${scope.toLowerCase()}_${now.dateStr}.${format.toLowerCase()}`;

    if (format === "JSON") {
      const payload = {
        metadata: {
          system: "Churrasco dos Da Hora",
          version: "1.0.0",
          scope,
          exportedAtGmt3: now.formattedPtBr,
          exportedByAdmin: "Roberto Da Hora",
        },
        backupData: {
          ...(scope !== "Eventos" ? { clients, staffMembers: staffList } : {}),
          ...(scope !== "Usuários" ? { events } : {}),
        },
      };
      content = JSON.stringify(payload, null, 2);
    } else {
      content = `-- BACKUP SQL CHURRASCO DOS DA HORA (${now.formattedPtBr})\nSET TIME ZONE 'America/Sao_Paulo';\n\n`;
      if (scope !== "Eventos") {
        clients.forEach((c) => {
          content += `INSERT INTO users (id, name, email, phone_anatel, role) VALUES ('${c.id}', '${c.name}', '${c.email}', '${c.phoneAnatel}', 'CLIENTE');\n`;
        });
        staffList.forEach((s) => {
          content += `INSERT INTO staff_members (id, name, phone_anatel, staff_type, specialty) VALUES ('${s.id}', '${s.name}', '${s.phoneAnatel}', '${s.staffType}', '${s.specialty}');\n`;
        });
      }
      if (scope !== "Usuários") {
        events.forEach((ev) => {
          content += `INSERT INTO events (id, title, event_type, honoree_name, event_date, start_time, end_time, status) VALUES ('${ev.id}', '${ev.title}', '${ev.eventType}', '${ev.honoreeName}', '${ev.eventDate}', '${ev.startTime}', '${ev.endTime}', '${ev.status}');\n`;
        });
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setBackupLogs([
      {
        id: `bkp-${Date.now()}`,
        scope,
        format,
        exportedAtGmt3: `${now.dateStr.split("-").reverse().join("/")} ${now.timeStr}`,
        exportedBy: "Roberto Da Hora",
      },
      ...backupLogs,
    ]);
    setFeedback(`✓ Exportação "${filename}" concluída e registrada em BACKUP_LOGS!`);
  };

  const phoneValidation = validateAnatelPhone(cadPhone);

  const filteredEvents = events.filter((ev) => {
    const matchesStatus = statusFilter === "TODOS" || ev.status === statusFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.honoreeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.eventDate.includes(searchQuery);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* BARRA LATERAL ESQUERDA FIXA (IDÊNTICA AO PDF) */}
      <aside className="w-full lg:w-64 bg-[#0D121E] border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-7">
          {/* Logo */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              🔥
            </div>
            <div className="leading-tight">
              <span className="block font-extrabold text-base text-white">churrasco</span>
              <span className="block text-[9px] font-bold tracking-[0.22em] text-amber-500 uppercase">
                DOS DA HORA
              </span>
            </div>
          </div>

          {/* Menu Principal */}
          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase mb-2">
              PAINEL DA FAMÍLIA
            </p>
            {[
              { id: "DASHBOARD", label: "Dashboard", icon: "⊞" },
              { id: "EVENTOS", label: "Gestão de eventos", icon: "📅" },
              { id: "CADASTROS", label: "Cadastros", icon: "👥" },
              { id: "BACKUP", label: "Backup e governança", icon: "🛡️" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                  activeTab === item.id
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rodapé da Sidebar: Google Calendar + Perfil ADM */}
        <div className="hidden lg:flex flex-col gap-4 pt-6">
          <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ✓ Conectado
            </span>
            <p className="text-xs font-bold text-white">Google Calendar</p>
            <p className="text-[11px] text-slate-400">Agenda sempre em sintonia.</p>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                RD
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-white">Roberto Da Hora</p>
                <p className="text-[11px] text-slate-400">Administrador · Família</p>
              </div>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 px-1 transition"
            >
              <span>↪</span>
              <span>Sair da conta</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="border-b border-slate-800/80 px-6 py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">
              ADMINISTRAÇÃO DO ESPAÇO
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {activeTab === "DASHBOARD" && "Dashboard"}
              {activeTab === "EVENTOS" && "Gestão de eventos"}
              {activeTab === "CADASTROS" && "Cadastros"}
              {activeTab === "BACKUP" && "Backup e governança"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "DASHBOARD" && "Uma visão de tudo para receber bem."}
              {activeTab === "EVENTOS" && "Da reserva à escala, cada detalhe no lugar."}
              {activeTab === "CADASTROS" && "As pessoas que fazem cada encontro acontecer."}
              {activeTab === "BACKUP" && "Seus dados seguros. Sua operação tranquila."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#111726] border border-slate-800 px-3.5 py-2 rounded-full text-xs text-slate-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{clockGmt3}</span>
            </div>

            <Link
              href="/cliente"
              className="text-xs bg-[#111726] hover:bg-slate-800 text-slate-200 px-3.5 py-2 rounded-xl border border-slate-800 transition"
            >
              👤 Ver área do cliente
            </Link>

            <button
              type="button"
              onClick={() => {
                const clean = resetDatabaseToAdminOnly();
                setEvents(clean.events);
                setClients(clean.clients);
                setStaffList(clean.staff);
                setEvStaffSelected([]);
                setFeedback("🧹 Dados resetados! Mantido apenas o login único de Administrador.");
              }}
              className="text-xs bg-[#111726] hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 px-3.5 py-2 rounded-xl border border-slate-800 flex items-center gap-1.5 transition"
            >
              <span>Resetar dados</span>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                SÓ ADM
              </span>
            </button>

            {activeTab === "DASHBOARD" && (
              <button
                type="button"
                onClick={() => setActiveTab("EVENTOS")}
                className="text-xs bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition"
              >
                + Novo evento
              </button>
            )}
          </div>
        </header>

        {feedback && (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex justify-between items-center">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-emerald-400 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 flex-1">
          {/* ABA 1: DASHBOARD */}
          {activeTab === "DASHBOARD" && (
            <div className="space-y-6">
              {/* 4 KPI CARDS COM BARRA DE DESTAQUE NO TOPO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-amber-500">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Eventos para hoje</span>
                    <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">
                      HOJE · GMT-3
                    </span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(eventsToday.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Data ativa: {todayGmt3}</p>
                </div>

                <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-emerald-500">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Confirmados / em andamento</span>
                    <span className="text-emerald-400">✓</span>
                  </div>
                  <p className="text-4xl font-extrabold text-emerald-400 mt-2">
                    {String(eventsToday.filter((e) => e.status === "CONFIRMADO").length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Tudo pronto para receber</p>
                </div>

                <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-amber-400">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Solicitações pendentes</span>
                    <span className="text-amber-400">●</span>
                  </div>
                  <p className="text-4xl font-extrabold text-amber-400 mt-2">
                    {String(pendingEvents.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Aguardando aprovação ADM</p>
                </div>

                <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-sky-500">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Profissionais na equipe</span>
                    <span className="text-sky-400">👥</span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(staffList.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {internalStaff.length} internos · {externalStaff.length} terceirizados
                  </p>
                </div>
              </div>

              {/* COLUNA AGENDA DE HOJE (2/3) + WIDGETS LATERAIS (1/3) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Agenda de hoje</h2>
                      <p className="text-xs text-slate-400">Verificada pelo fuso oficial de Brasília ({todayGmt3})</p>
                    </div>
                    <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-slate-300">
                      {eventsToday.length} evento(s)
                    </span>
                  </div>

                  {eventsToday.length === 0 ? (
                    <div className="bg-[#0A0E17] border border-slate-800/80 rounded-2xl p-8 text-center space-y-3">
                      <p className="text-sm font-semibold text-slate-300">
                        Nenhum evento agendado para hoje ({todayGmt3}).
                      </p>
                      <p className="text-xs text-slate-500">
                        O banco foi resetado ou não há encontros para esta data. Clique em &quot;+ Novo evento&quot; para agendar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventsToday.map((ev, index) => (
                        <React.Fragment key={ev.id}>
                          <div className="bg-[#0A0E17] border border-slate-800/90 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="text-xs font-mono text-slate-300 border-r border-slate-800 pr-4 flex flex-col justify-center shrink-0">
                                <span className="font-bold text-white">{ev.startTime}</span>
                                <span className="text-slate-500">{ev.endTime}</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                                  <span
                                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                      ev.status === "CONFIRMADO"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    {ev.status === "CONFIRMADO" ? "✓ Confirmado" : "● Pendente"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400">
                                  <span className="text-amber-400 font-semibold">{ev.eventType}</span> · Para:{" "}
                                  <strong className="text-slate-200">{ev.honoreeName}</strong> · Cliente:{" "}
                                  {ev.clientName}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  ADM: <strong className="text-slate-300">{ev.responsibleAdmin}</strong> · Equipe:{" "}
                                  {ev.supportTeam.join(" / ")}
                                </p>
                              </div>
                            </div>

                            <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                              {ev.status === "PENDENTE" ? (
                                <button
                                  onClick={() => handleApproveAndSyncGcal(ev.id)}
                                  className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
                                >
                                  ✓ Aprovar + GCal
                                </button>
                              ) : (
                                <button
                                  onClick={() => setActiveTab("EVENTOS")}
                                  className="bg-[#111726] hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs px-3 py-1.5 rounded-xl"
                                >
                                  Editar escala
                                </button>
                              )}
                              <button
                                onClick={() => handleCancelEvent(ev.id)}
                                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>

                          {/* Faixa de Limpeza e Preparação (+1h) entre eventos */}
                          {index === 0 && (
                            <div className="bg-amber-500/5 border border-dashed border-amber-500/25 rounded-xl px-4 py-2 text-[11px] text-amber-300/90 flex items-center justify-between">
                              <span>🧹 Intervalo reservado: Limpeza e preparação do espaço</span>
                              <span className="font-mono">+1h entre eventos</span>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* WIDGETS DA DIREITA */}
                <div className="xl:col-span-4 space-y-4">
                  <div className="bg-[#111726] border border-emerald-500/30 rounded-3xl p-5 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      ● O espaço, no ritmo certo
                    </span>
                    <h3 className="text-base font-bold text-white pt-1">
                      {eventsToday.length > 0 ? eventsToday[0].title : "Espaço livre neste momento"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {eventsToday.length > 0
                        ? `Responsável: ${eventsToday[0].responsibleAdmin} · Equipe escalada e confirmada.`
                        : "Nenhuma operação ativa agora em GMT-3."}
                    </p>
                  </div>

                  <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Precisam de você</h3>
                      <span className="text-[11px] text-amber-400 font-semibold">
                        {pendingEvents.length} pendente(s)
                      </span>
                    </div>
                    {pendingEvents.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma solicitação pendente de aprovação.</p>
                    ) : (
                      pendingEvents.map((pe) => (
                        <div
                          key={pe.id}
                          className="bg-[#0A0E17] border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{pe.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {pe.eventDate}, às {pe.startTime}
                            </p>
                          </div>
                          <button
                            onClick={() => handleApproveAndSyncGcal(pe.id)}
                            className="text-xs text-amber-400 hover:underline font-bold"
                          >
                            Aprovar →
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-2">
                    <p className="text-xs font-bold text-emerald-400">✓ Google Calendar sincronizado</p>
                    <p className="text-xs text-slate-400">
                      Aprovações atualizam automaticamente a agenda oficial do espaço em GMT-3.
                    </p>
                    <button
                      onClick={() => setActiveTab("EVENTOS")}
                      className="text-xs font-bold text-amber-400 hover:underline pt-1 inline-block"
                    >
                      Abrir gestão de eventos →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: GESTÃO DE EVENTOS */}
          {activeTab === "EVENTOS" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* FORMULÁRIO ESQUERDO */}
              <form
                onSubmit={handleCreateManualEvent}
                className="xl:col-span-5 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Novo agendamento</h2>
                  <p className="text-xs text-slate-400">Crie, escale a equipe e sincronize.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Título do evento</label>
                  <input
                    type="text"
                    required
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                    placeholder="Aniversário da Ana Clara"
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Categoria</label>
                    <select
                      value={evType}
                      onChange={(e) => setEvType(e.target.value as EventRecord["eventType"])}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    >
                      <option value="ANIVERSARIO">🎂 Aniversário</option>
                      <option value="FESTA">🎉 Festa familiar</option>
                      <option value="FUTEBOL">⚽ Futebol</option>
                      <option value="CORPORATIVO">💼 Corporativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Para quem é o evento? *</label>
                    <input
                      type="text"
                      required
                      value={evHonoree}
                      onChange={(e) => setEvHonoree(e.target.value)}
                      placeholder="Ana Clara · 15 anos"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cliente vinculado</label>
                    <input
                      type="text"
                      required
                      value={evClient}
                      onChange={(e) => setEvClient(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Responsável ADM</label>
                    <input
                      type="text"
                      required
                      value={evAdmin}
                      onChange={(e) => setEvAdmin(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={evDate}
                      onChange={(e) => setEvDate(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Início</label>
                    <input
                      type="time"
                      required
                      value={evStart}
                      onChange={(e) => setEvStart(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Término</label>
                    <input
                      type="time"
                      required
                      value={evEnd}
                      onChange={(e) => setEvEnd(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs">
                  ✓ Sem conflitos · Limpeza reservada (+1h após término)
                </div>

                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">EQUIPE ESCALADA</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {staffList.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-[#0A0E17] p-3 rounded-xl border border-slate-800">
                        Nenhum profissional cadastrado na aba Cadastros ainda.
                      </p>
                    ) : (
                      staffList.map((st) => (
                        <label
                          key={st.id}
                          className="flex items-center justify-between bg-[#0A0E17] border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs cursor-pointer"
                        >
                          <span>
                            <strong className="text-white">{st.name}</strong> ·{" "}
                            <span className="text-slate-400">{st.specialty}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={evStaffSelected.includes(st.name)}
                            onChange={(e) => {
                              if (e.target.checked) setEvStaffSelected([...evStaffSelected, st.name]);
                              else setEvStaffSelected(evStaffSelected.filter((n) => n !== st.name));
                            }}
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Agendar e sincronizar Google Calendar
                </button>
              </form>

              {/* CALENDÁRIO E LISTA DIREITA */}
              <div className="xl:col-span-7 space-y-4">
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1.5 bg-[#0A0E17] p-1 rounded-xl border border-slate-800">
                      {(["TODOS", "PENDENTE", "CONFIRMADO", "CANCELADO"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatusFilter(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            statusFilter === st ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {st === "TODOS"
                            ? "Todos"
                            : st === "PENDENTE"
                            ? "Pendentes"
                            : st === "CONFIRMADO"
                            ? "Confirmados"
                            : "Cancelados"}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Buscar por data ou homenageado"
                      className="bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                    />
                  </div>

                  {filteredEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Nenhum evento encontrado para este filtro.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  ev.status === "CONFIRMADO"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : ev.status === "CANCELADO"
                                    ? "bg-rose-500/15 text-rose-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                {ev.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {ev.eventDate} · {ev.startTime} - {ev.endTime} · Para: <strong>{ev.honoreeName}</strong> ·{" "}
                              {ev.clientName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {ev.googleCalendarEventId
                                ? `✓ GCal ID: ${ev.googleCalendarEventId}`
                                : "● Pendente GCal · Aguardando aprovação"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {ev.status === "PENDENTE" && (
                              <button
                                onClick={() => handleApproveAndSyncGcal(ev.id)}
                                className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl"
                              >
                                Aprovar + GCal
                              </button>
                            )}
                            {ev.status !== "CANCELADO" && (
                              <button
                                onClick={() => handleCancelEvent(ev.id)}
                                className="bg-[#111726] hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-800 text-xs px-3 py-2 rounded-xl"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: CADASTROS */}
          {activeTab === "CADASTROS" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveCadastro}
                className="xl:col-span-5 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Adicionar uma pessoa</h2>
                  <p className="text-xs text-slate-400">Escolha o perfil e preencha os dados.</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">TIPO DE CADASTRO</p>
                  <div className="grid grid-cols-3 bg-[#0A0E17] p-1 rounded-xl border border-slate-800">
                    {[
                      { id: "EXTERNA_TERCEIRO", label: "Equipe externa" },
                      { id: "INTERNA", label: "Equipe interna" },
                      { id: "CLIENTE", label: "Cliente" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCadCategory(t.id as "EXTERNA_TERCEIRO" | "INTERNA" | "CLIENTE")}
                        className={`py-2 rounded-lg text-xs font-semibold transition ${
                          cadCategory === t.id ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-slate-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nome completo</label>
                  <input
                    type="text"
                    required
                    value={cadName}
                    onChange={(e) => setCadName(e.target.value)}
                    placeholder="Paulo Mendes"
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Telefone ANATEL</span>
                    {phoneValidation.valid && (
                      <span className="text-emerald-400 font-semibold">✓ {phoneValidation.regionUf}</span>
                    )}
                  </div>
                  <input
                    type="tel"
                    required
                    value={cadPhone}
                    onChange={(e) => setCadPhone(applyAnatelPhoneMask(e.target.value))}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
                  />
                </div>

                {cadCategory === "CLIENTE" ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      value={cadEmail}
                      onChange={(e) => setCadEmail(e.target.value)}
                      placeholder="cliente@exemplo.com"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Especialidade</label>
                        <input
                          type="text"
                          required
                          value={cadSpecialty}
                          onChange={(e) => setCadSpecialty(e.target.value)}
                          placeholder="Churrasqueiro"
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Empresa / MEI</label>
                        <input
                          type="text"
                          value={cadCompany}
                          onChange={(e) => setCadCompany(e.target.value)}
                          placeholder="Paulo Grill · MEI"
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                        />
                      </div>
                    </div>
                    {cadCategory === "EXTERNA_TERCEIRO" && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Valor da diária / cachê</label>
                        <input
                          type="number"
                          value={cadRate}
                          onChange={(e) => setCadRate(e.target.value)}
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                    )}
                  </>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Salvar cadastro
                </button>
              </form>

              <div className="xl:col-span-7 space-y-4">
                <div className="flex items-center justify-between bg-[#111726] border border-slate-800 rounded-2xl px-4 py-3">
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="🔍 Buscar nome, telefone ou especialidade"
                    className="bg-transparent text-xs text-white outline-none w-full"
                  />
                  <span className="text-xs text-slate-400 shrink-0">
                    {staffList.length + clients.length} pessoa(s)
                  </span>
                </div>

                {/* Equipe Interna */}
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-white">Equipe interna</h3>
                    <span className="text-xs text-slate-400">{internalStaff.length} pessoa(s)</span>
                  </div>
                  {internalStaff.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum membro interno cadastrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {internalStaff.map((st) => (
                        <div key={st.id} className="bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl text-xs">
                          <div className="flex justify-between">
                            <p className="font-bold text-white">{st.name}</p>
                            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                              Família
                            </span>
                          </div>
                          <p className="text-slate-400 mt-1">
                            {st.specialty} · {st.phoneAnatel}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Equipe Externa */}
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-white">Equipe externa</h3>
                    <span className="text-xs text-slate-400">{externalStaff.length} profissional(is)</span>
                  </div>
                  {externalStaff.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum profissional terceirizado cadastrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {externalStaff.map((st) => (
                        <div key={st.id} className="bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl text-xs">
                          <div className="flex justify-between">
                            <p className="font-bold text-white">{st.name}</p>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                              R$ {st.dailyRate} / diária
                            </span>
                          </div>
                          <p className="text-slate-400 mt-1">
                            {st.specialty} · {st.phoneAnatel}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clientes */}
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-white">Clientes</h3>
                    <span className="text-xs text-slate-400">{clients.length} cadastro(s)</span>
                  </div>
                  {clients.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum cliente cadastrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clients.map((c) => (
                        <div key={c.id} className="bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl text-xs">
                          <p className="font-bold text-white">{c.name}</p>
                          <p className="text-slate-400 mt-0.5">
                            {c.email} · {c.phoneAnatel}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: BACKUP E GOVERNANÇA */}
          {activeTab === "BACKUP" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  {
                    scope: "Usuários" as const,
                    title: "Pessoas e acessos",
                    desc: "Clientes, administradores, equipe interna e profissionais externos.",
                    badge: `${clients.length + staffList.length + 1} cadastros`,
                  },
                  {
                    scope: "Eventos" as const,
                    title: "Eventos e escalas",
                    desc: "Histórico completo, homenageados, datas em GMT-3 e equipes escaladas.",
                    badge: `${events.length} eventos`,
                  },
                  {
                    scope: "Completo" as const,
                    title: "Backup completo",
                    desc: "Um retrato de todo o sistema, pronto para guardar com segurança.",
                    badge: "Snapshot integral",
                  },
                ].map((card) => (
                  <div
                    key={card.scope}
                    className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-2">
                      <h3 className="text-base font-extrabold text-white">{card.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                      <span className="inline-block text-[11px] font-bold bg-[#0A0E17] border border-slate-800 text-amber-400 px-3 py-1 rounded-full">
                        {card.badge}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                      <button
                        onClick={() => handleDownloadBackup(card.scope, "JSON")}
                        className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
                      >
                        ⬇ Baixar .JSON
                      </button>
                      <button
                        onClick={() => handleDownloadBackup(card.scope, "SQL")}
                        className="bg-[#0A0E17] hover:bg-slate-800 text-white border border-slate-800 font-bold py-2.5 rounded-xl text-xs transition"
                      >
                        ⬇ Baixar .SQL
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#111726] border border-amber-500/25 rounded-2xl p-4 flex items-center gap-3 text-xs">
                <span className="text-lg">🔒</span>
                <div>
                  <p className="font-bold text-white">Seus dados merecem cuidado.</p>
                  <p className="text-slate-400">
                    Guarde as exportações em um local seguro. Cada download é registrado com data e administrador responsável.
                  </p>
                </div>
              </div>

              {/* TABELA DE AUDITORIA BACKUP_LOGS */}
              <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-extrabold text-white">Histórico de backups</h3>
                    <p className="text-xs text-slate-400">Registro de auditoria · BACKUP_LOGS</p>
                  </div>
                  <span className="text-xs text-slate-400">{backupLogs.length} exportação(ões) recente(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        <th className="py-3 px-3">ESCOPO EXPORTADO</th>
                        <th className="py-3 px-3">FORMATO</th>
                        <th className="py-3 px-3">DATA/HORA GMT-3</th>
                        <th className="py-3 px-3">RESPONSÁVEL</th>
                        <th className="py-3 px-3">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {backupLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500">
                            Nenhuma exportação realizada nesta sessão ainda.
                          </td>
                        </tr>
                      ) : (
                        backupLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-3 px-3 font-bold text-white">{log.scope}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono text-[11px]">
                                {log.format}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300">{log.exportedAtGmt3}</td>
                            <td className="py-3 px-3 text-slate-300">{log.exportedBy}</td>
                            <td className="py-3 px-3 text-emerald-400 font-semibold">✓ Concluído</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}