class AutoragResultsPage {
  findStopRunButton() {
    return cy.findByRole('button', { name: /stop/i });
  }

  findRetryRunButton() {
    return cy.findByRole('button', { name: /retry/i });
  }

  findRunDetailsButton() {
    return cy.findByRole('button', { name: /run details/i });
  }

  findRunInProgressMessage() {
    return cy.contains('Your AutoRAG run is currently in progress');
  }

  findRunStatusLabel(timeout?: number) {
    return cy.contains('.pf-v6-c-label', /cancel|fail/i, timeout ? { timeout } : undefined);
  }

  // Leaderboard
  findLeaderboardTable() {
    return cy.get('[aria-label="AutoRAG Pattern Leaderboard"]');
  }

  findLeaderboardLoading() {
    return cy.get('[aria-label="AutoRAG Pattern Leaderboard"]').find('.pf-v6-c-skeleton');
  }

  findLeaderboardEmpty() {
    return cy.contains('No patterns produced');
  }

  findManageColumnsButton() {
    return cy.findByRole('button', { name: /manage columns/i });
  }

  findManageColumnsModal() {
    return cy.findByRole('dialog');
  }

  findManageColumnsCancelButton() {
    return cy.findByRole('dialog').findByRole('button', { name: 'Cancel' });
  }

  findManageColumnsSaveButton() {
    return cy.findByRole('dialog').findByRole('button', { name: 'Save' });
  }

  findTopRankLabel() {
    return cy.get('.pf-v6-c-label').contains('1').closest('.pf-v6-c-label');
  }

  findLeaderboardRow(rank: number) {
    return cy
      .get('[aria-label="AutoRAG Pattern Leaderboard"]')
      .find('tbody tr')
      .eq(rank - 1);
  }

  findPatternLink(rank: number) {
    return this.findLeaderboardRow(rank).find('a, button.pf-v6-c-button.pf-m-link');
  }

  // Run details drawer
  findRunDetailsDrawerPanel() {
    return cy.get('.pf-v6-c-drawer__panel');
  }

  findRunDetailsDrawerClose() {
    return cy.get('.pf-v6-c-drawer__close').find('button');
  }

  // Stop run modal
  findStopRunModal() {
    return cy.findByRole('dialog', { name: /stop/i });
  }

  findConfirmStopRunButton() {
    return this.findStopRunModal().findByRole('button', { name: /^stop$/i });
  }

  // Pattern details modal
  findPatternDetailsModal() {
    return cy.get('.pf-v6-c-modal-box');
  }

  findPatternDetailsModalCloseButton() {
    return this.findPatternDetailsModal().findByRole('button', { name: 'Close' });
  }

  findPatternSelectorDropdown() {
    return this.findPatternDetailsModal().find('.pf-v6-c-menu-toggle');
  }

  findPatternDetailsDownload() {
    return this.findPatternDetailsModal().findByRole('button', { name: /download/i });
  }

  findSaveNotebookToggle() {
    return this.findPatternDetailsModal().find('.pf-v6-c-menu-toggle:contains("Save as notebook")');
  }

  findSaveIndexingNotebook() {
    return cy.get('.pf-v6-c-menu__list').contains('button', /indexing/i);
  }

  findSaveInferenceNotebook() {
    return cy.get('.pf-v6-c-menu__list').contains('button', /inference/i);
  }

  // Pattern details tabs — use case-insensitive regex to handle casing differences across builds
  findPatternDetailsTab(tabKey: string) {
    /* eslint-disable camelcase -- tab keys match backend API field names */
    const tabNames: Record<string, string> = {
      pattern_information: 'pattern information',
      vector_store: 'vector store',
      chunking: 'chunking',
      embedding: 'embedding',
      retrieval: 'retrieval',
      generation: 'generation',
      sample_qa: 'sample q&a',
    };
    /* eslint-enable camelcase */
    const name = tabNames[tabKey] ?? tabKey;
    return cy.findByRole('tab', { name: new RegExp(name, 'i') });
  }

  // Runs table (experiments page)
  findRunsTable() {
    return cy.get('table.pf-v6-c-table');
  }

  findRunLink(runId: string) {
    return cy.contains('a', runId);
  }

  findStopRunAction() {
    return cy.findByRole('menuitem', { name: /stop/i });
  }

  findRetryRunAction() {
    return cy.findByRole('menuitem', { name: /retry/i });
  }

  /**
   * Waits up to `timeoutMs` (default 30 min) for the run to complete.
   * Asserts that the leaderboard table appears. Fails if a
   * canceled/failed status label appears instead.
   */
  waitForRunCompletion(timeoutMs = 1800000) {
    cy.contains('Your AutoRAG run is currently in progress', { timeout: timeoutMs }).should(
      'not.exist',
    );
    this.findLeaderboardTable().should('be.visible');
    this.findTopRankLabel().should('exist');
  }

  // Score type radios (inside pattern details overview tab)
  findScoreTypeRadio(type: 'mean' | 'ci_high' | 'ci_low') {
    /* eslint-disable camelcase -- keys match backend score type identifiers */
    const labels: Record<string, string> = {
      mean: 'Mean',
      ci_high: 'CI high',
      ci_low: 'CI low',
    };
    /* eslint-enable camelcase */
    return cy.findByRole('radio', { name: new RegExp(labels[type], 'i') });
  }

  /**
   * Runs the common post-run results verification flow:
   * - Leaderboard interaction (drawer, manage columns)
   * - Pattern details modal with all tabs
   * - Score type radio buttons
   * - Notebook downloads
   */
  verifyResultsInteraction() {
    cy.step('Verify leaderboard has at least one pattern row');
    this.findLeaderboardRow(1).should('exist');

    cy.step('Open and close run details drawer');
    this.findRunDetailsButton().click();
    this.findRunDetailsDrawerPanel().should('be.visible');
    this.findRunDetailsDrawerClose().click();
    this.findRunDetailsDrawerPanel().should('not.be.visible');

    cy.step('Open manage columns modal and close it');
    this.findManageColumnsButton().click();
    this.findManageColumnsModal().should('be.visible');
    this.findManageColumnsCancelButton().click();
    this.findManageColumnsModal().should('not.exist');

    cy.step('Open pattern details modal for top-ranked pattern');
    this.findPatternLink(1).click();
    this.findPatternDetailsModal().should('be.visible');

    cy.step('Verify Pattern information tab (overview) is active by default');
    this.findPatternDetailsTab('pattern_information').should('exist');

    cy.step('Verify score type radio buttons on overview tab');
    this.findScoreTypeRadio('mean').should('exist');
    this.findScoreTypeRadio('ci_high').should('exist');
    this.findScoreTypeRadio('ci_low').should('exist');
    this.findScoreTypeRadio('ci_high').click();
    this.findScoreTypeRadio('mean').click();

    cy.step('Navigate to Vector store settings tab');
    this.findPatternDetailsTab('vector_store').should('exist').click();

    cy.step('Navigate to Chunking settings tab');
    this.findPatternDetailsTab('chunking').should('exist').click();

    cy.step('Navigate to Embedding settings tab');
    this.findPatternDetailsTab('embedding').should('exist').click();

    cy.step('Navigate to Retrieval settings tab');
    this.findPatternDetailsTab('retrieval').should('exist').click();

    cy.step('Navigate to Generation settings tab');
    this.findPatternDetailsTab('generation').should('exist').click();

    cy.step('Check if Sample Q&A tab exists (conditional on evaluation results)');
    this.findPatternDetailsModal().then(($modal) => {
      const hasSampleQA = $modal.find('[role="tab"]').filter(function sampleQaFilter() {
        return /sample\s+q&?a/i.test(Cypress.$(this).text());
      }).length;
      if (hasSampleQA) {
        this.findPatternDetailsTab('sample_qa').click();
      }
    });

    cy.step('Close pattern details modal');
    this.findPatternDetailsModalCloseButton().click();
    this.findPatternDetailsModal().should('not.exist');

    cy.step('Download notebook (stub window.print)');
    this.findPatternLink(1).click();
    this.findPatternDetailsModal().should('be.visible');
    cy.window().then((win) => cy.stub(win, 'print'));
    this.findPatternDetailsDownload().click();
    cy.window().its('print').should('have.been.calledOnce');
    this.findPatternDetailsModalCloseButton().click();
    this.findPatternDetailsModal().should('not.exist');
  }
}

export const autoragResultsPage = new AutoragResultsPage();
