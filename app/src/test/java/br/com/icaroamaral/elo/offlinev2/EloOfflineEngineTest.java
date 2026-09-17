package br.com.icaroamaral.elo.offlinev2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.Test;

public class EloOfflineEngineTest {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private static final List<EloOfflineTrack> TRACKS = List.of(
            new EloOfflineTrack("beethoven-fur-elise", "Für Elise", "Ludwig van Beethoven", "piano classical", List.of("fur elise", "beethoven"), List.of("fur.opus")),
            new EloOfflineTrack("debussy-clair-de-lune", "Clair de Lune", "Claude Debussy", "piano classical", List.of("clair de lune", "debussy"), List.of("clair.opus")),
            new EloOfflineTrack("pachelbel-canon-in-d", "Canon in D Major", "Pachelbel", "classical", List.of("canon de pachelbel"), List.of("canon.opus"))
    );

    @Test public void saudacao() { assertTrue(engine().handle("Bom dia").getText().contains("Bom dia")); }

    @Test public void hoje() { assertEquals("Hoje é 31/12/2025.", engine("2025-12-31T15:00:00Z").handle("Que dia é hoje?").getText()); }

    @Test public void amanha() { assertEquals("Amanhã será 01/01/2026.", engine("2025-12-31T15:00:00Z").handle("E amanhã?").getText()); }

    @Test public void ontem() { assertEquals("Ontem foi 30/12/2025.", engine("2025-12-31T15:00:00Z").handle("Que dia foi ontem?").getText()); }

    @Test public void viradaDeAno() { assertEquals("Depois de amanhã será 02/01/2026.", engine("2025-12-31T15:00:00Z").handle("Depois de amanhã").getText()); }

    @Test public void fevereiroAnoBissexto() { assertEquals("Amanhã será 01/03/2024.", engine("2024-02-29T15:00:00Z").handle("amanhã").getText()); }

    @Test public void mesEAno() {
        assertTrue(engine("2025-12-31T15:00:00Z").handle("qual o mês?").getText().contains("dezembro"));
        assertTrue(engine("2025-12-31T15:00:00Z").handle("qual o ano?").getText().contains("2025"));
    }

    @Test public void multiplicacao() { assertEquals("Resultado: 1000", engine().handle("quanto é 125 x 8?").getText()); }

    @Test public void porcentagem() { assertEquals("Resultado: 30", engine().handle("quanto é 15% de 200?").getText()); }

    @Test public void porcentagemPorExtenso() { assertEquals("Resultado: 30", engine().handle("quanto é 15 por cento de 200?").getText()); }

    @Test public void volume() { assertEquals("Volume: 5,76 m³", engine().handle("uma laje de 8 x 6 x 0,12 m tem quantos m³?").getText()); }

    @Test public void continuidadeMatematica() {
        EloOfflineEngine current = engine();
        assertEquals("Resultado: 1000", current.handle("quanto é 125 x 8?").getText());
        assertEquals("Resultado: 3000", current.handle("E vezes 3?").getText());
    }

    @Test public void area() { assertEquals("Área: 48 m²", engine().handle("área de 8 x 6").getText()); }

    @Test public void perimetro() { assertEquals("Perímetro: 28 m", engine().handle("perímetro de 8 x 6").getText()); }

    @Test public void raiz() { assertEquals("Raiz quadrada: 9", engine().handle("raiz quadrada de 81").getText()); }

    @Test public void conversao() { assertEquals("Conversão: 200 cm", engine().handle("2 m em centímetros").getText()); }

    @Test public void impermeabilizacao() {
        EloOfflineResult result = engine().handle("O que é impermeabilização?");
        assertTrue(result.getHandled());
        assertTrue(result.getText().contains("passagem de água"));
    }

    @Test public void alvenaria() { assertTrue(engine().handle("Qual a sequência básica para executar alvenaria?").getText().contains("prumo e nível")); }

    @Test public void fissuraEmRevestimento() { assertTrue(engine().handle("O que pode causar fissura em revestimento?").getText().contains("retração")); }

    @Test public void chapiscoNaoCaiEmRevestimentos() { assertTrue(engine().handle("chapisco").getText().contains("camada de preparo")); }

    @Test public void pedidoOnlineOffline() {
        EloOfflineResult result = engine().handle("Pesquise o preço do cimento");
        assertTrue(result.getHandled());
        assertTrue(result.toString(), result.getRequiresInternet());
        assertTrue(result.toString(), result.getText().contains("precisa de internet"));
    }

    @Test public void musicaFurElise() {
        EloOfflineResult result = engine().handle("Toque Für Elise");
        assertTrue(result.getAction() instanceof EloOfflineAction.PlayTrack);
        assertEquals("beethoven-fur-elise", ((EloOfflineAction.PlayTrack) result.getAction()).getTrackId());
    }

    @Test public void musicaClairDeLune() { assertTrue(engine().handle("toque Clair de Lune").getAction() instanceof EloOfflineAction.PlayTrack); }

    @Test public void proxima() { assertTrue(engine().handle("próxima").getAction() instanceof EloOfflineAction.NextTrack); }

    @Test public void anterior() { assertTrue(engine().handle("anterior").getAction() instanceof EloOfflineAction.PreviousTrack); }

    @Test public void stopAndResume() {
        assertTrue(engine().handle("pause").getAction() instanceof EloOfflineAction.Stop);
        assertTrue(engine().handle("pausar").getAction() instanceof EloOfflineAction.Stop);
        assertTrue(engine().handle("continue").getAction() instanceof EloOfflineAction.Resume);
    }

    @Test public void stopAliasesProduceNativeStop() {
        for (String command : List.of("parar", "pare", "stop", "pare a música", "parar música", "parar a música")) {
            assertTrue(command, engine().handle(command).getAction() instanceof EloOfflineAction.Stop);
        }
        assertFalse(engine().handle("parede").getAction() instanceof EloOfflineAction.Stop);
    }

    @Test public void percentageMillionsAndShortContextOperations() {
        EloOfflineEngine current = engine();
        assertEquals("Resultado: 99500000", current.handle("quanto é 10% de 995 milhões").getText());
        assertEquals("Resultado: 49750000", current.handle("e dividido por 2?").getText());
        assertEquals("Resultado: 149250000", current.handle("e vezes 3?").getText());
        assertEquals("Resultado: 150000000", current.handle("e mais 750 mil?").getText());
    }

    @Test public void stopDoesNotMatchPeaceOfMindBySingleToken() {
        List<EloOfflineTrack> tracks = List.of(
                new EloOfflineTrack("peace-of-mind", "Peace of Mind", "Boston", "rock", List.of("mind"), List.of("peace.opus"))
        );
        EloOfflineResult result = new EloOfflineEngine(
                tracks,
                TechnicalKnowledgeEngine.Companion.defaults(),
                Clock.systemDefaultZone()
        ).handle("toque Sweet Child of Mind");
        assertFalse(result.getAction() instanceof EloOfflineAction.PlayTrack);
        assertFalse(result.getRequiresInternet());
        assertTrue(result.getText().contains("não está disponível"));
    }

    @Test public void faixaAtual() {
        EloOfflineEngine current = engine();
        current.handle("toque Für Elise");
        EloOfflineResult result = current.handle("O que está tocando?");
        assertTrue(result.getAction() instanceof EloOfflineAction.CurrentTrack);
        assertTrue(result.getText().contains("Für Elise"));
    }

    @Test public void embaralhar() { assertTrue(engine().handle("embaralhe").getAction() instanceof EloOfflineAction.Shuffle); }

    @Test public void conversaOffline() {
        assertTrue(engine().handle("Você funciona sem internet?").getText().contains("funcionando localmente"));
        assertFalse(engine().handle("Você funciona sem internet?").getRequiresInternet());
    }

    @Test public void fallbackHumano() {
        EloOfflineResult result = engine().handle("explique algo impossível");
        assertFalse(result.toString(), result.getHandled());
        assertTrue(result.toString(), result.getText().contains("Não consegui resolver isso offline"));
    }

    @Test public void baseTecnicaEstruturada() {
        String source = "[{\"topic\":\"impermeabilização\",\"keywords\":[\"impermeabilização\"],\"answer\":\"base local\"}]";
        EloOfflineEngine current = new EloOfflineEngine(TRACKS, TechnicalKnowledgeEngine.Companion.fromJson(source), Clock.systemDefaultZone());
        assertEquals("base local", current.handle("impermeabilização").getText());
    }

    @Test public void simulacaoConversaOffline() {
        EloOfflineEngine current = engine("2025-12-31T15:00:00Z");
        String[] localRequests = {
                "Bom dia", "Que dia é hoje?", "E amanhã?", "Quanto é 125 x 8?", "E vezes 3?",
                "O que é impermeabilização?", "Toque Für Elise", "O que está tocando?", "Você funciona sem internet?"
        };
        for (String request : localRequests) {
            EloOfflineResult result = current.handle(request);
            assertTrue(request, result.getHandled());
            assertFalse(request, result.getRequiresInternet());
        }
        EloOfflineResult online = current.handle("Pesquise o preço do cimento");
        assertTrue(online.getHandled());
        assertTrue(online.getRequiresInternet());
    }

    private static EloOfflineEngine engine() { return engine("2025-06-15T15:00:00Z"); }

    private static EloOfflineEngine engine(String instant) {
        return new EloOfflineEngine(TRACKS, TechnicalKnowledgeEngine.Companion.defaults(), Clock.fixed(Instant.parse(instant), ZONE));
    }
}
