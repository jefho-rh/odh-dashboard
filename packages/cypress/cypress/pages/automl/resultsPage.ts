class AutomlResultsPage {
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
    return cy.contains('Your AutoML run is currently in progress');
  }

  findRunStatusLabel(timeout?: number) {
    return cy.contains('.pf-v6-c-label', /cancel|fail/i, timeout ? { timeout } : undefined);
  }

  // Leaderboard
  findLeaderboardTable() {
    return cy.get('[aria-label*="Leaderboard"]');
  }

  findLeaderboardLoading() {
    return cy.get('[aria-label*="Leaderboard"]').find('.pf-v6-c-skeleton');
  }

  findLeaderboardEmpty() {
    return cy.contains('No models produced');
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
      .get('[aria-label*="Leaderboard"]')
      .find('tbody tr')
      .eq(rank - 1);
  }

  findModelLink(rank: number) {
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

  // Model details modal
  findModelDetailsModal() {
    return cy.get('.pf-v6-c-modal-box');
  }

  findModelDetailsModalCloseButton() {
    return this.findModelDetailsModal().findByRole('button', { name: 'Close' });
  }

  findModelSelectorDropdown() {
    return this.findModelDetailsModal().find('.pf-v6-c-menu-toggle');
  }

  findModelDetailsDownloadButton() {
    return this.findModelDetailsModal().findByRole('button', { name: /download/i });
  }

  findModelDetailsActionsToggle() {
    return this.findModelDetailsModal().find('[aria-label*="ctions"]');
  }

  findRegisterModelAction() {
    return cy.findByRole('menuitem', { name: /register/i });
  }

  findSaveNotebookAction() {
    return cy.findByRole('menuitem', { name: /save.*notebook/i });
  }

  // Model details modal tabs
  findModelDetailsTab(tabKey: string) {
    /* eslint-disable camelcase -- tab keys match backend API field names */
    const tabNames: Record<string, string> = {
      'model-information': 'model information',
      'feature-summary': 'feature summary',
      'model-evaluation': 'model evaluation',
      'confusion-matrix': 'confusion matrix',
    };
    /* eslint-enable camelcase */
    const name = tabNames[tabKey] ?? tabKey;
    return cy.findByRole('tab', { name: new RegExp(name, 'i') });
  }

  // Feature summary tab
  findFeatureSearchInput() {
    return this.findModelDetailsModal().find('input[type="search"], input[aria-label*="Search"]');
  }

  // Confusion matrix tab
  findConfusionMatrixTable() {
    return this.findModelDetailsModal().find('table');
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
   * Asserts that the leaderboard table appears.
   */
  waitForRunCompletion(timeoutMs = 1800000) {
    cy.contains('Your AutoML run is currently in progress', { timeout: timeoutMs }).should(
      'not.exist',
    );
    this.findLeaderboardTable().should('be.visible');
    this.findTopRankLabel().should('exist');
  }

  /**
   * Runs the common post-run results verification flow:
   * - Leaderboard interaction (drawer, manage columns)
   * - Model details modal (tab navigation based on task type)
   * - Download notebook (with window.print stub)
   */
  verifyResultsInteraction(taskType: 'binary' | 'multiclass' | 'regression' | 'timeseries') {
    const isClassification = taskType === 'binary' || taskType === 'multiclass';
    const isTimeseries = taskType === 'timeseries';

    cy.step('Verify leaderboard has at least one model row');
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

    cy.step('Open model details modal');
    this.findModelLink(1).click();
    this.findModelDetailsModal().should('be.visible');

    cy.step('Verify expected tabs are present');
    this.findModelDetailsTab('model-information').should('exist');
    this.findModelDetailsTab('model-evaluation').should('exist');

    if (!isTimeseries) {
      this.findModelDetailsTab('feature-summary').should('exist');
      this.findModelDetailsTab('feature-summary').click();
      this.findFeatureSearchInput().should('be.visible');
    } else {
      this.findModelDetailsTab('feature-summary').should('not.exist');
    }

    if (isClassification) {
      this.findModelDetailsTab('confusion-matrix').should('exist');
    } else {
      this.findModelDetailsTab('confusion-matrix').should('not.exist');
    }

    cy.step('Close model details modal');
    this.findModelDetailsModalCloseButton().click();
    this.findModelDetailsModal().should('not.exist');

    cy.step('Download notebook (stub window.print)');
    this.findModelLink(1).click();
    this.findModelDetailsModal().should('be.visible');
    cy.window().then((win) => cy.stub(win, 'print'));
    this.findModelDetailsDownloadButton().click();
    cy.window().its('print').should('have.been.calledOnce');
    this.findModelDetailsModalCloseButton().click();
    this.findModelDetailsModal().should('not.exist');
  }
}

export const automlResultsPage = new AutomlResultsPage();
