"use client";
import { useEffect, useRef, useState } from "react";
import PianoRoll from "../components/PianoRoll.jsx";
import * as Tone from "tone";
import { Midi } from '@tonejs/midi';
import TittleCaption from "../components/TittleCaption.jsx";
import ChangeVolume from "../components/ChangeVolume.jsx";
import translations from "../locales/language.js";
import ChangeInstrument from "../components/ChangeInstrument.jsx";
import SelectRitmo from "../components/SelectRitmo";
import { useRouter } from "next/navigation"; 

function EditorPage() {
  const rows = 49;
  const initialCols = 10;
    const notes = [
    "C6", "B5", "A#5", "A5", "G#5", "G5", "F#5", "F5", "E5", "D#5",
    "D5", "C#5", "C5", "B4", "A#4", "A4", "G#4", "G4", "F#4", "F4",
    "E4", "D#4", "D4", "C#4", "C4", "B3", "A#3", "A3", "G#3", "G3",
    "F#3", "F3", "E3", "D#3", "D3", "C#3", "C3", "B2", "A#2", "A2",
    "G#2", "G2", "F#2", "F2", "E2", "D#2", "D2", "C#2", "C2"
  ];

  const acousticInstruments = [
    "bass-electric", "bassoon", "cello", "clarinet", "contrabass",
    "flute", "french-horn", "guitar-acoustic", "guitar-electric",
    "guitar-nylon", "harmonium", "harp", "organ", "piano", "saxophone",
    "trombone", "trumpet", "tuba", "violin", "xylophone"
  ];

  const instruments = {
    synth: () => new Tone.PolySynth(Tone.Synth).toDestination()
  };

  acousticInstruments.forEach(name => {
    instruments[name] = () => new Tone.Sampler({
      urls: { C4: "C4.mp3" },
      baseUrl: `https://nbrosowsky.github.io/tonejs-instruments/samples/${name}/`,
    }).toDestination();
  });

  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [activeCol, setActiveCol] = useState(null);
  const [activeSubIndex, setActiveSubIndex] = useState(0);
  const [cols, setCols] = useState(initialCols);

  const createSubNote = (name = null) => ({
    name,           // ex: "C4" ou null
    isSeparated: false
  });

  const createNote = (noteName = null, duration = 1) => {
    return {
      name: noteName,      // ex: "C4"
      duration,            // valor rítmico: 1, 2, 4, 8, ...
      subNotes: Array(duration).fill(createSubNote()),
    };
  };
  const [matrixNotes, setMatrixNotes] = useState(
    Array.from({ length: initialCols }, () =>
        Array.from({ length: rows }, () =>
            createNote()
        )
    )
  );

  const [pages, setPages] = useState([matrixNotes]);
  const [activePage, setActivePage] = useState(0);
  const [lang, setLang] = useState("en");
  const [instrument, setInstrument] = useState('synth');
  const [volume, setVolume] = useState(-10);
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rhythm, setRhythm] = useState(1);
  const [selectedColumn, setSelectedColumn] = useState(null);

  const synthRef = useRef(null);

  // Effects

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
    } else {
      setLoading(false);
    }
  }, [router]);
 
  useEffect(() => {
    synthRef.current = instruments[instrument]().toDestination();
    synthRef.current.volume.value = volume;

    if (synthRef.current instanceof Tone.PolySynth) {
      synthRef.current.set({
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
        maxPolyphony: 49,
      });
    }

    return () => synthRef.current?.dispose();
  }, [instrument]);

  useEffect(() => {
    Tone.getDestination().volume.rampTo(volume, 0.1);
  }, [volume]);

  useEffect(() => {
    if (selectedColumn === null) {
      console.log("❌ selectedColumn é null, saindo do useEffect.");
      return;
    }

    console.log("🎯 Atualizando coluna:", selectedColumn);
    console.log("🎼 Novo valor de rhythm:", rhythm);

    setPages((prevPages) => {
      const currentMatrix = prevPages[activePage];

      if (!Array.isArray(currentMatrix)) {
        console.error("🚨 currentMatrix não é um array:", currentMatrix);
        return prevPages;
      }

      const updatedMatrix = currentMatrix.map((col, colIdx) => {
        if (!Array.isArray(col)) {
          console.error(`🚨 col ${colIdx} não é array:`, col);
          return col;
        }

        if (colIdx !== selectedColumn) {
          console.log(`⏩ Mantendo coluna ${colIdx} intacta.`);
          return col;
        }

        console.log(`🛠️ Atualizando coluna ${colIdx}...`);

        const updatedCol = col.map((note, noteIdx) => {
          const oldSubNotes = note.subNotes || [];
          console.log(`  🎵 Nota ${noteIdx}:`);
          console.log("    🔹 Subnotas antigas:", oldSubNotes);

          const newSubNotes = Array.from({ length: rhythm }, (_, i) => {
            const existing = oldSubNotes[i];
            const sub = existing ? { ...existing } : createSubNote();
            console.log(`    🔧 subNote[${i}] =`, sub);
            return sub;
          });

          return {
            ...note,
            subNotes: newSubNotes,
          };
        });

        return updatedCol;
      });

      const updatedPages = [...prevPages];
      updatedPages[activePage] = updatedMatrix;
      console.log("✅ Novo estado de pages[activePage]:", JSON.stringify(updatedMatrix));
      return updatedPages;
    });
  }, [rhythm]);


  useEffect(() => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[activePage] = matrixNotes;
      return newPages;
    });
  }, [matrixNotes, activePage]);

  // Helper functions
  const t = (key, params) => {
    let text = translations[lang][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const renderKeys = () => {
    return notes.map((note, index) => {
      const isBlackKey = note.includes("#");
      return (
          <div
              onClick={() => playNotePiano(note.split(" ")[0])}
              key={index}
              className={`note ${isBlackKey ? 'black' : ''}`}
          >
            <p>{note}</p>
          </div>
      );
    });
  };

  // Core functions
  
  const addPage = () => {
    const newMatrix =     Array.from({ length: initialCols }, () =>
        Array.from({ length: rows }, () =>
            createNote()
        )
    );
    setPages(prev => [...prev, newMatrix]);
    setMatrixNotes(newMatrix);
    setActivePage(pages.length);
  };

  const movePage = (change) => {
    setActivePage(prev => {
      const next = prev + change;
      if (next < 0) return 0;
      if (next >= pages.length) return pages.length - 1;

      setMatrixNotes(pages[next]);
      return next;
    });
  };

  const playNotePiano = (note) => {
    if (!synthRef.current) return;

    // Toca a nota
    synthRef.current.triggerAttackRelease(note, "8n");

    // Opcional: podemos adicionar um feedback visual
    const noteElement = document.querySelector(`.note p[data-note="${note}"]`)?.parentElement;
    if (noteElement) {
      noteElement.classList.add('active');
      setTimeout(() => noteElement.classList.remove('active'), 200);
    }
  };
  const playSelectedNotesActivePage = async (n) => {
    if (isPlaying) {
      console.warn('Playback já em execução.');
      return;
    }

    console.log(`[play] Iniciando reprodução da página ${n}`);
    const currentMatrix = pages[n];
    if (!currentMatrix || currentMatrix.length === 0) {
      console.warn('[play] Matriz da página vazia ou inexistente.');
      return;
    }

    setIsPlaying(true);
    let lastNoteTime = 0;
    const activeNotes = new Map();

    try {
      console.log(`[play] Configurando BPM: ${bpm}`);
      Tone.getTransport().bpm.value = bpm;
      Tone.getTransport().cancel();

      const highlightTimes = [];


      currentMatrix.forEach((col, colIndex) => {
        const colTime = colIndex * Tone.Time("4n").toSeconds();
        console.log(`[col ${colIndex}] Tempo da coluna: ${colTime}s`);

        // Destacar coluna
        Tone.getTransport().schedule((t) => {
          console.log(`[transport] Coluna ativa: ${colIndex} @ ${t}`);
        }, colTime);

        col.forEach((note, rowIndex) => {
          if (!note?.subNotes?.length) return;

          // Duração de cada subnota em segundos
          const subDuration = Tone.Time("4n").toSeconds() / note.duration;
          console.log(`[row ${rowIndex}] ${note.subNotes.length} subnotas com duração ${subDuration}s cada`);

          let currentNote = null;
          let noteStartTime = 0;

          note.subNotes.forEach((subNote, subIdx) => {
            highlightTimes.push({
              time: colTime + (subIdx * subDuration),
              colIndex,
              subIndex: subIdx
            });

            const currentName = subNote?.name;
            const noteKey = `${rowIndex}-${colIndex}-${subIdx}`;
            const subTime = colTime + (subIdx * subDuration);

            // Condições para START (início de nova nota)
            const isStartBecauseFirst = colIndex === 0 && subIdx === 0;
            const isStartBecauseSeparated = subNote.isSeparated;

            // Verifica se a subnota anterior NA MESMA COLUNA está vazia ou é diferente
            const isPrevSubNoteEmptyOrDifferent = subIdx > 0 &&
                (!note.subNotes[subIdx - 1]?.name || note.subNotes[subIdx - 1]?.name !== currentName);

            // Verifica se a ÚLTIMA subnota da COLUNA ANTERIOR está vazia ou é diferente
            const prevColLastSubNote = colIndex > 0 ?
                currentMatrix[colIndex - 1]?.[rowIndex]?.subNotes?.slice(-1)[0] : null;
            const isPrevColLastNoteEmptyOrDifferent = colIndex > 0 &&
                (!prevColLastSubNote?.name || prevColLastSubNote?.name !== currentName);

            const shouldStartNewNote = currentName && (
                isStartBecauseFirst ||
                isStartBecauseSeparated ||
                isPrevSubNoteEmptyOrDifferent ||
                isPrevColLastNoteEmptyOrDifferent
            );

            if (shouldStartNewNote) {
              console.log(`🔵 START CONDITION for ${currentName} at [${rowIndex},${colIndex},${subIdx}]:`, {
                isStartBecauseFirst,
                isStartBecauseSeparated,
                isPrevSubNoteEmptyOrDifferent,
                isPrevColLastNoteEmptyOrDifferent,
                prevNote: note.subNotes[subIdx - 1]?.name,
                currentNote: currentName
              });
            }

            // Condições para END (término de nota)
            const isEndBecauseLast = colIndex === currentMatrix.length - 1 &&
                subIdx === note.subNotes.length - 1;
            const isEndBecauseSeparated = subNote.isSeparated;

            // Verifica se a próxima subnota NA MESMA COLUNA está vazia ou é diferente
            const isNextSubNoteEmptyOrDifferent = subIdx < note.subNotes.length - 1 &&
                (!note.subNotes[subIdx + 1]?.name || note.subNotes[subIdx + 1]?.name !== currentName);

            // Verifica se a PRIMEIRA subnota da PRÓXIMA COLUNA está vazia ou é diferente
            const nextColFirstSubNote = colIndex < currentMatrix.length - 1 ?
                currentMatrix[colIndex + 1]?.[rowIndex]?.subNotes[0] : null;
            const isNextColFirstNoteEmptyOrDifferent = colIndex < currentMatrix.length - 1 &&
                (!nextColFirstSubNote?.name || nextColFirstSubNote?.name !== currentName);

            const shouldEndNote = currentName && (
                isEndBecauseLast ||
                isEndBecauseSeparated ||
                isNextSubNoteEmptyOrDifferent ||
                isNextColFirstNoteEmptyOrDifferent
            );

            if (shouldEndNote) {
              console.log(`🔴 END CONDITION for ${currentName} at [${rowIndex},${colIndex},${subIdx}]:`, {
                isEndBecauseLast,
                isEndBecauseSeparated,
                isNextSubNoteEmptyOrDifferent,
                isNextColFirstNoteEmptyOrDifferent,
                currentNote: currentName,
                nextNote: note.subNotes[subIdx + 1]?.name
              });
            }

            // Verifica se precisa iniciar uma nova nota
            if (shouldStartNewNote) {
              // Se havia uma nota em andamento, encerra primeiro
              if (currentNote) {
                const endTime = colTime + ((subIdx - 1) * subDuration) + subDuration;
                console.log(`🛑 Fim antecipado: ${currentNote} @ ${endTime}`);
                Tone.getTransport().schedule((t) => {
                  console.log(`⏹️ TriggerRelease: ${currentNote} @ ${t}`);
                  synthRef.current?.triggerRelease(currentNote, t);
                  activeNotes.delete(`${rowIndex}-${colIndex}-${subIdx - 1}`);
                }, endTime);
              }

              // Agenda início da nova nota
              console.log(`🎵 Início: ${currentName} [${noteKey}] @ ${subTime}`);
              Tone.getTransport().schedule((t) => {
                console.log(`▶️ TriggerAttack: ${currentName} @ ${t}`);
                synthRef.current?.triggerAttack(currentName, t);
                activeNotes.set(noteKey, { note: currentName, time: t });
              }, subTime);

              currentNote = currentName;
              noteStartTime = subTime;
            }

            // Verifica se precisa encerrar a nota atual
            if (shouldEndNote) {
              const endTime = subTime + subDuration;
              console.log(`🛑 Fim: ${currentName} [${noteKey}] @ ${endTime}`);
              Tone.getTransport().schedule((t) => {
                console.log(`⏹️ TriggerRelease: ${currentName} @ ${t}`);
                synthRef.current?.triggerRelease(currentName, t);
                activeNotes.delete(noteKey);
              }, endTime);

              currentNote = null;
              noteStartTime = 0;
            }

            lastNoteTime = Math.max(lastNoteTime, subTime + subDuration);
          });
        });
      });

      const totalColsTime = currentMatrix.length * Tone.Time("4n").toSeconds();
      console.log(`[play] Total de tempo: ${totalColsTime}s`);

      highlightTimes.sort((a, b) => a.time - b.time).forEach(({time, colIndex, subIndex}) => {
        Tone.getTransport().schedule(() => {
          setActiveCol(colIndex);
          setActiveSubIndex(subIndex);
        }, time);
      });

      await Tone.start();
      console.log('[tone] Transport iniciado');
      Tone.getTransport().start();

      await new Promise(resolve => {
        setTimeout(() => {
          console.log('[play] Playback encerrado');
          Tone.getTransport().stop();
          synthRef.current?.releaseAll?.();
          setIsPlaying(false);
          resolve();
        }, (lastNoteTime + 0.1) * 1000);
      });

    } catch (error) {
      console.error('Erro na reprodução:', error);
      Tone.getTransport().stop();
      synthRef.current?.releaseAll?.();
      setIsPlaying(false);
    }
  };

  const playSong = async () => {
    if (isPlaying) {
      console.warn('Playback já em execução.');
      return;
    }

    setIsPlaying(true);
    setActivePage(0);
    setMatrixNotes(pages[0]);
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    synthRef.current?.releaseAll?.();

    for (let i = 0; i < pages.length; i++) {
      setActivePage(i);
      setMatrixNotes(pages[i]);
      await playSelectedNotesActivePage(i);
    }

    setIsPlaying(false);
  };

const exportToMIDI = () => {
  const musicData = {
    bpm,
    instrument,
    volume,
    rhythm,
    pages: pages.map(page =>
      page.map(column =>
        column.map(note => ({
          name: note.name,
          duration: note.duration,
          subNotes: note.subNotes.map(sub => ({
            name: sub.name,
            isSeparated: sub.isSeparated
          }))
        }))
      )
    ),
  };

  const json = JSON.stringify(musicData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "music.json";
  a.click();
  URL.revokeObjectURL(url);
};

const importFromMIDI = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    try {
      const data = JSON.parse(content);

      setBpm(data.bpm);
      setInstrument(data.instrument);
      setVolume(data.volume);
      setRhythm(data.rhythm);
      setPages(data.pages);
      setMatrixNotes(data.pages[0]);
      setActivePage(0);

      alert("Música importada com sucesso!");
    } catch (error) {
      console.error("Erro ao importar música:", error);
      alert("Falha ao importar. Verifique o arquivo.");
    }
  };
  reader.readAsText(file);
};

  if (loading) {
    return <div>Carregando...</div>;
  }
  // Render
  return (
      <div className="app-container">
        <TittleCaption
            onPlaySong={playSong}
            onPlayActivePage={() => playSelectedNotesActivePage(activePage)}
            onExport={exportToMIDI}
            onImport={importFromMIDI}
            onSave={() => console.log('Save clicked')}
            setLang={setLang}
            lang={lang}
            t={t}
        />

        <div id="home">
          <div className="data">
            <div className="control-panel">
              <div className="control-group">
                <ChangeInstrument
                    instrument={instrument}
                    instruments={instruments}
                    setInstrument={setInstrument}
                    synthRef={synthRef}
                />
              </div>

              <div className="control-group">
                <ChangeVolume
                    volume={volume}
                    setVolume={setVolume}
                    synthRef={synthRef}
                />
              </div>

              <div className="control-group">
                <h3>{t("tempo")}</h3>
                <div className="control-item">
                  <label>{t("bpmLabel")}: {bpm}</label>
                  <input
                      type="range"
                      min="40"
                      max="300"
                      step="10"
                      className="control-range"
                      value={bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                  />
                </div>
              </div>

              <SelectRitmo rhythm={rhythm} setRhythm={setRhythm} />

              <div className="control-group">
                <h3>{t("versions")}</h3>
                <div className="control-item">
                  <select name="cars" className="control-select" id="cars">
                    <option value="volvo">Volvo</option>
                    <option value="saab">Saab</option>
                    <option value="mercedes">Mercedes</option>
                    <option value="audi">Audi</option>
                  </select>
                </div>
              </div>

              <div className="control-group">
                <h3>{t("page")}</h3>
                <p className="text-sm">
                  {t("pageOf", { current: activePage + 1, total: pages.length })}
                </p>
                <div className="page-buttons">
                  <button onClick={() => movePage(-1)}>⬅</button>
                  <button onClick={addPage}>✛</button>
                  <button onClick={() => movePage(1)}>⮕</button>
                </div>
              </div>
            </div>
          </div>

          <div id="edit-window">
            <div id="piano-roll-container">
              <div id="notes">{renderKeys()}</div>
              <PianoRoll
                  synthRef={synthRef}
                  bpm={bpm}
                  pages={pages}
                  setPages={setPages}
                  activeCol={activeCol}
                  activeSubIndex={activeSubIndex}
                  setActiveCol={setActiveCol}
                  cols={cols}
                  setCols={setCols}
                  rows={rows}
                  notes={notes}
                  activePage={activePage}
                  setActivePage={setActivePage}
                  selectedColumn={selectedColumn}
                  setSelectedColumn={setSelectedColumn}
                  createSubNote={createSubNote}
              />
            </div>
          </div>

        </div>
      </div>
  );
}

export default EditorPage;