import React from "react";
// frontend/src/App.jsx — AppShell Mantine + Router
import { MantineProvider, AppShell, Container, Group, Button, Text, Badge } from "@mantine/core";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

import OverviewPanel from "./components/OverviewPanel";
import AuctionsTabsLayout from "./components/auctions/AuctionsTabsLayout";
import AuctionsHome from "./components/auctions/AuctionsHome";
import AuctionSectorPage from "./components/auctions/AuctionSectorPage";

export default function App() {
  return (
    <MantineProvider theme={{ primaryColor: "teal", defaultRadius: "md" }}>
      <BrowserRouter>
        <AppShell header={{ height: 60 }} footer={{ height: 44 }} padding="md">
          {/* Header */}
          <AppShell.Header>
            <Container size="lg" h="100%">
              <Group h="100%" justify="space-between">
                <Group gap="sm">
                  <Text fw={800}>Étika</Text>
                  <Badge variant="light">MVP</Badge>
                </Group>
                <Group gap="xs">
                  {/* Libellé changé : "Notre projet" */}
                  <Button component={Link} to="/overview" variant="subtle">Notre projet</Button>
                  <Button component={Link} to="/auctions" variant="filled">Enchères</Button>
                </Group>
              </Group>
            </Container>
          </AppShell.Header>

          {/* Contenu */}
          <AppShell.Main>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPanel />} />

              {/* Enchères avec sous-onglets */}
              <Route path="/auctions" element={<AuctionsTabsLayout />}>
                <Route index element={<AuctionsHome />} />
                <Route path=":sectorSlug" element={<AuctionSectorPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </AppShell.Main>

          {/* Footer */}
          <AppShell.Footer>
            <Container size="lg">
              <Group justify="space-between" py="xs">
                <Text size="sm" c="dimmed">Étika pré-token → token</Text>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Vitrine</Text>
                  <Text size="sm" c="dimmed">Participer</Text>
                  <Text size="sm" c="dimmed">Sponsoriser</Text>
                  <Text size="sm" c="dimmed">Investir</Text>
                  <Text size="sm" c="dimmed">Communauté</Text>
                </Group>
              </Group>
            </Container>
          </AppShell.Footer>
        </AppShell>
      </BrowserRouter>
    </MantineProvider>
  );
}
