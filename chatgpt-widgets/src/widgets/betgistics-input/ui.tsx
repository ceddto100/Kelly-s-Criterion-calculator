/**
 * Betgistics Input Widget (ChatGPT Widget Builder compatible)
 *
 * Drop this JSX into the Widget Builder "Code" tab. It wires to the
 * analyze_matchup_and_log_bet MCP tool and exposes bankroll/odds/Kelly/userId/logBet
 * with tasteful styling.
 */

<Card size="sm" variant="ghost" padding={3} radius="lg">
  <Col gap={3}>
    <Row align="center" gap={2}>
      <Icon name="analytics" size="lg" color="primary" />
      <Title value="Betgistics" size="md" />
      <Badge label="Widget Agent" variant="solid" tone="primary" />
      <Spacer />
      <Badge label="Edge + Kelly" variant="soft" tone="secondary" />
    </Row>

    <Text
      value="Paste a short game note; we’ll parse, price, and size the bet."
      size="sm"
      color="secondary"
    />

    <Divider />

    <Form onSubmitAction={{ type: "analyze_matchup_and_log_bet" }}>
      <Col gap={3}>
        <Textarea
          name="userText"
          defaultValue={initialUserText}
          required
          rows={3}
          placeholder="e.g., NBA: Lakers vs Warriors, Lakers -3.5, odds -115, bankroll 2k"
          autoResize
          maxRows={6}
          variant="filled"
        />

        <Row gap={2}>
          <Input
            name="bankroll"
            inputType="number"
            placeholder="Bankroll ($, optional)"
            defaultValue={initialBankroll}
            prefix="$"
            variant="soft"
          />
          <Input
            name="americanOdds"
            inputType="text"
            placeholder="Odds (e.g., -110)"
            defaultValue={initialOdds}
            variant="soft"
          />
        </Row>

        <Row gap={2} wrap>
          <Select
            name="kellyFraction"
            options={[
              { label: "Quarter Kelly (0.25)", value: "0.25" },
              { label: "Half Kelly (0.5)", value: "0.5" },
              { label: "Full Kelly (1.0)", value: "1.0" }
            ]}
            defaultValue={defaultKelly}
            pill
            variant="soft"
          />
          <Input
            name="userId"
            placeholder="User ID/handle (optional)"
            defaultValue={initialUserId}
            variant="soft"
          />
          <Checkbox
            name="logBet"
            label="Log bet"
            defaultChecked={defaultLogBet}
            helperText="Store in history if DB is connected"
          />
        </Row>

        <Row align="center" gap={2}>
          <Text size="xs" color="secondary">
            Defaults: bankroll $1,000 • odds -110 • Half Kelly if omitted.
          </Text>
          <Spacer />
          <Button
            submit
            label="Analyze"
            style="primary"
            iconStart="sparkle"
            size="md"
            variant="glow"
          />
        </Row>
      </Col>
    </Form>
  </Col>
</Card>
