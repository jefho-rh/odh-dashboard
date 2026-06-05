import { autoragExperimentsPage } from './experimentsPage';
import { autoragResultsPage } from './resultsPage';
import { HTPASSWD_CLUSTER_ADMIN_USER } from '../../utils/e2eUsers';
import { waitForDspaReady } from '../../utils/oc_commands/dspa';
import type { AutoragTestData } from '../../types';

class AutoragConfigurePage {
  visit(namespace: string) {
    cy.visitWithLogin(`/gen-ai-studio/autorag/configure/${namespace}`);
    this.wait();
  }

  private wait() {
    cy.findByRole('heading', { name: /autorag/i, level: 1 });
    cy.testA11y();
  }

  // Step 1 - Create
  findNameInput() {
    return cy.get('#display_name');
  }

  findDescriptionInput() {
    return cy.get('#description');
  }

  findLlamaStackSecretSelector() {
    return cy.get('[placeholder="Select Llama Stack secret"]');
  }

  findAddLlamaStackConnectionButton() {
    return cy.findByRole('button', { name: /add new.*connection/i });
  }

  findNextButton() {
    return cy.findByRole('button', { name: /next/i });
  }

  findConfigureStepSubtitle() {
    return cy.contains('h2, h3, [class*="title"]', /configurations/i);
  }

  // Step 2 - Documents panel
  findSecretSelector() {
    return cy.get('[placeholder="Select connection"]');
  }

  findSelectFileToggle() {
    return cy.get('#document-input-select');
  }

  findUploadFileToggle() {
    return cy.get('#document-input-upload');
  }

  findUploadFileInput() {
    return cy.get('input[type="file"]').first();
  }

  findUploadSpinner() {
    return cy.get('[aria-label="Uploading file"]');
  }

  findBrowseBucketButton() {
    return cy.findByRole('button', { name: /browse bucket/i });
  }

  // File Explorer
  findFileExplorerSearch() {
    return cy.get('.pf-v6-c-modal-box').find('input[type="search"], input[aria-label*="Search"]');
  }

  findFileExplorerTable() {
    return cy.get('.pf-v6-c-modal-box').find('table');
  }

  findFileExplorerRow(filePath: string) {
    return cy.get('.pf-v6-c-modal-box').find('table').contains('td', filePath).parent('tr');
  }

  findFileExplorerSelectBtn() {
    return cy.get('.pf-v6-c-modal-box').findByRole('button', { name: /select file/i });
  }

  // Step 2 - Model selection
  findModelSelectionSection() {
    return cy.get('[aria-label="Model selection tabs"]');
  }

  findModelTable(modelType: 'llm' | 'embedding') {
    const label = modelType === 'llm' ? 'Foundation models' : 'Embedding models';
    return cy.get(`[aria-label="${label} table"]`);
  }

  findModelRow(modelId: string) {
    return cy.contains('tr', modelId);
  }

  // Step 2 - Vector store
  findVectorStoreSelector() {
    return cy.contains('.pf-v6-c-menu-toggle', /vector/i, { timeout: 30000 });
  }

  findVectorStoreOption(providerId: string) {
    return cy.get('.pf-v6-c-menu__list').contains('button', providerId);
  }

  findFirstVectorStoreOption() {
    return cy.get('.pf-v6-c-menu__list').find('li').first();
  }

  // Step 2 - Optimization — match by the selected metric text in the toggle
  findOptimizationMetricSelect() {
    return cy.contains('.pf-v6-c-menu-toggle', /faithfulness|correctness/i);
  }

  findMetricOption(value: string) {
    const pattern = value.replace(/_/g, '[_ ]');
    return cy.get('.pf-v6-c-menu__list').contains('button', new RegExp(pattern, 'i'));
  }

  findMaxRagPatternsInput() {
    return cy.get('#max-rag-patterns').closest('.pf-v6-c-number-input');
  }

  setMaxRagPatterns(value: number) {
    this.findMaxRagPatternsInput().find('input').type(`{selectall}${value}`);
  }

  // Step 2 - Experiment settings
  findExperimentSettingsModal() {
    return cy.findByRole('dialog', { name: /model configuration/i });
  }

  findExperimentSettingsSave() {
    return this.findExperimentSettingsModal().findByRole('button', { name: /save/i });
  }

  findExperimentSettingsCancel() {
    return this.findExperimentSettingsModal().findByRole('button', { name: /cancel/i });
  }

  findSelectOption(name: string | RegExp) {
    return cy.findByRole('option', { name: name instanceof RegExp ? name : new RegExp(name) });
  }

  // Evaluation dataset
  findEvaluationFileInput() {
    return cy.get('input[type="file"]').last();
  }

  // Uploaded file table
  findUploadedFileCell() {
    return cy.get('[data-label="File"]');
  }

  // Submit
  findCreateRunButton() {
    return cy.findByRole('button', { name: /create run/i });
  }

  /**
   * Common setup for submitting an AutoRAG run.
   *
   * Handles: login, wait for DSPA, navigate to experiments, create run,
   * fill name/description, select Llama Stack secret, select S3 connection,
   * upload document, and select first available models + vector store.
   *
   * After this, optionally configure metric/patterns, then call `submitRun()`.
   */
  submitRunSetup(testData: AutoragTestData, projectName: string, uuid: string) {
    cy.step('Login and wait for pipeline server');
    cy.visitWithLogin('/', HTPASSWD_CLUSTER_ADMIN_USER);
    waitForDspaReady(projectName);

    cy.step('Navigate to AutoRAG experiments page');
    autoragExperimentsPage.visit(projectName);

    cy.step('Wait for pipeline server to be fully ready and click Create run');
    cy.findByRole('heading', { name: /autorag/i, level: 1, timeout: 120000 }).should('be.visible');
    autoragExperimentsPage.findCreateRunButton().click();

    cy.step('Step 1 - Fill name and description');
    this.findNameInput().should('be.visible', { timeout: 30000 }).type(testData.runName);
    this.findDescriptionInput().type(testData.runDescription);

    cy.step('Step 1 - Select Llama Stack secret');
    this.findLlamaStackSecretSelector().click();
    this.findLlamaStackSecretSelector().type(testData.llamaStackSecretName);
    this.findSelectOption(new RegExp(testData.llamaStackSecretName, 'i')).click();

    cy.step('Click Next to go to Configure step');
    this.findNextButton().click();

    cy.step('Verify configure step subtitle shows the run name');
    this.findConfigureStepSubtitle().should('contain.text', testData.runName);

    cy.step('Select S3 connection');
    this.findSecretSelector().click();
    this.findSecretSelector().type(testData.s3SecretName);
    this.findSelectOption(new RegExp(testData.s3SecretName, 'i')).click();

    cy.step('Upload document file');
    const uploadFileName = `${testData.documentFile.replace('.txt', '')}-${uuid}.txt`;
    this.findUploadFileToggle().click();
    this.findUploadFileInput().selectFile(
      { contents: `resources/autorag/${testData.documentFile}`, fileName: uploadFileName },
      { force: true },
    );

    cy.step('Wait for upload to complete');
    this.findUploadSpinner().should('not.exist');
    this.findUploadedFileCell().should('be.visible');

    cy.step('Verify uploaded file is browsable in file explorer and select it');
    this.findSelectFileToggle().click();
    this.findBrowseBucketButton().click();
    this.findFileExplorerTable().should('be.visible');
    this.findFileExplorerSearch().type(uploadFileName);
    this.findFileExplorerTable()
      .contains('td', uploadFileName)
      .should('be.visible')
      .closest('tr')
      .find('input[type="radio"]')
      .click();
    this.findFileExplorerSelectBtn().click();

    cy.step('Upload evaluation dataset JSON');
    const evalFileName = `${testData.evaluationFile.replace('.json', '')}-${uuid}.json`;
    this.findEvaluationFileInput().selectFile(
      { contents: `resources/autorag/${testData.evaluationFile}`, fileName: evalFileName },
      { force: true },
    );

    cy.step('Select first available vector store');
    this.findVectorStoreSelector().click();
    this.findFirstVectorStoreOption().should('be.visible').click();
    // Verify the selection was applied — dropdown should close and placeholder text should be gone
    cy.contains('.pf-v6-c-menu-toggle', /select vector/i).should('not.exist');
  }

  /**
   * Submit the AutoRAG run and verify redirect to results page.
   * Call after `submitRunSetup()` and any custom configuration.
   */
  submitRun() {
    cy.step('Submit the form');
    this.findCreateRunButton().click();

    cy.step('Verify redirect to results page');
    cy.url().should('include', '/gen-ai-studio/autorag/results/');

    cy.step('Verify the run is in progress');
    autoragResultsPage.findRunInProgressMessage().should('be.visible');
  }
}

export const autoragConfigurePage = new AutoragConfigurePage();
