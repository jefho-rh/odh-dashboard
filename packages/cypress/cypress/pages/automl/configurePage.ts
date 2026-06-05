import { automlExperimentsPage } from './experimentsPage';
import { automlResultsPage } from './resultsPage';
import { HTPASSWD_CLUSTER_ADMIN_USER } from '../../utils/e2eUsers';
import { waitForDspaReady } from '../../utils/oc_commands/dspa';
import type { AutomlTestData } from '../../types';

class AutomlConfigurePage {
  visit(namespace: string) {
    cy.visitWithLogin(`/develop-train/automl/configure/${namespace}`);
    this.wait();
  }

  private wait() {
    cy.findByRole('heading', { name: /automl/i, level: 1 });
    cy.testA11y();
  }

  // Step 1 - Create
  findNameInput() {
    return cy.get('#display_name');
  }

  findDescriptionInput() {
    return cy.get('#description');
  }

  findNextButton() {
    return cy.findByRole('button', { name: 'Next' });
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

  // File Explorer Modal
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

  // Step 2 - Configure details panel
  findTaskTypeCard(type: string) {
    return cy.contains('.pf-v6-c-card', new RegExp(type, 'i'));
  }

  // Tabular fields (binary, multiclass, regression)
  findLabelColumnSelect() {
    return cy.get('#label_column').closest('.pf-v6-c-menu-toggle');
  }

  // Timeseries fields
  findTargetColumnSelect() {
    return cy.get('#target_column').closest('.pf-v6-c-menu-toggle');
  }

  findTimestampColumnSelect() {
    return cy.get('#timestamp_column').closest('.pf-v6-c-menu-toggle');
  }

  findIdColumnSelect() {
    return cy.get('#id_column').closest('.pf-v6-c-menu-toggle');
  }

  // Top N models
  findTopNInput() {
    return cy.get('#top-n-input').closest('.pf-v6-c-number-input');
  }

  setTopN(value: number) {
    this.findTopNInput().find('input').type(`{selectall}${value}`);
  }

  findSelectOption(name: string | RegExp) {
    return cy.findByRole('option', { name: name instanceof RegExp ? name : new RegExp(name) });
  }

  // Upload result
  findUploadedFileCell() {
    return cy.get('[data-label="File"]');
  }

  // Submit
  findCreateRunButton() {
    return cy.findByRole('button', { name: /create run/i });
  }

  /**
   * Common setup for submitting an AutoML run.
   *
   * Handles: login, wait for DSPA, navigate to experiments, create run,
   * fill name/description, select S3 connection, and upload file.
   *
   * After this, configure task-specific options (task type, label column, etc.)
   * then call `submitRun()`.
   */
  submitRunSetup(testData: AutomlTestData, projectName: string, uuid: string) {
    cy.step('Login and wait for pipeline server');
    cy.visitWithLogin('/', HTPASSWD_CLUSTER_ADMIN_USER);
    waitForDspaReady(projectName);

    cy.step('Navigate to AutoML experiments page');
    automlExperimentsPage.visit(projectName);

    cy.step('Wait for pipeline server to be fully ready and click Create run');
    cy.findByRole('heading', { name: /automl/i, level: 1, timeout: 120000 }).should('be.visible');
    automlExperimentsPage.findCreateRunButton().click();

    cy.step('Step 1 - Fill name and description');
    this.findNameInput().should('be.visible', { timeout: 30000 }).type(testData.runName);
    this.findDescriptionInput().type(testData.runDescription);
    this.findNextButton().click();

    cy.step('Verify configure step subtitle shows the run name');
    this.findConfigureStepSubtitle().should('contain.text', testData.runName);

    cy.step('Select S3 connection');
    this.findSecretSelector().click();
    this.findSecretSelector().type(testData.secretName);
    this.findSelectOption(new RegExp(testData.secretName, 'i')).click();

    cy.step('Upload CSV file');
    const uploadFileName = `${testData.trainingDataFile.replace('.csv', '')}-${uuid}.csv`;
    this.findUploadFileToggle().click();
    this.findUploadFileInput().selectFile(
      { contents: `resources/automl/${testData.trainingDataFile}`, fileName: uploadFileName },
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
  }

  /**
   * Submit the AutoML run and verify redirect to results page.
   * Call after `submitRunSetup()` and task-specific configuration.
   */
  submitRun() {
    cy.step('Submit the form');
    this.findCreateRunButton().click();

    cy.step('Verify redirect to results page');
    cy.url().should('include', '/develop-train/automl/results/');

    cy.step('Verify the run is in progress');
    automlResultsPage.findRunInProgressMessage().should('be.visible');
  }
}

export const automlConfigurePage = new AutomlConfigurePage();
