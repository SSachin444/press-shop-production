package com.phaindia.mes

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.PermanentNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.NavDestination
import com.phaindia.mes.model.RolePolicy
import com.phaindia.mes.ui.AppViewModel
import com.phaindia.mes.ui.MainUiState
import com.phaindia.mes.ui.screens.AttendanceScreen
import com.phaindia.mes.ui.screens.AuditLogScreen
import com.phaindia.mes.ui.screens.DashboardScreen
import com.phaindia.mes.ui.screens.ForcedPasswordChangeDialog
import com.phaindia.mes.ui.screens.HandoversScreen
import com.phaindia.mes.ui.screens.HourlyEntryScreen
import com.phaindia.mes.ui.screens.LiveCellStatusScreen
import com.phaindia.mes.ui.screens.MachinesScreen
import com.phaindia.mes.ui.screens.ManpowerScreen
import com.phaindia.mes.ui.screens.ProductionOverviewScreen
import com.phaindia.mes.ui.screens.ReportsScreen
import com.phaindia.mes.ui.screens.RoleGatewayScreen
import com.phaindia.mes.ui.screens.SettingsScreen
import com.phaindia.mes.ui.screens.UsersScreen
import com.phaindia.mes.ui.theme.PhaColors
import com.phaindia.mes.ui.theme.PhaPressShopTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PhaPressShopTheme {
                val vm: AppViewModel = viewModel()
                PhaAppRoot(vm)
            }
        }
    }
}

@Composable
fun PhaAppRoot(vm: AppViewModel) {
    val state by vm.ui.collectAsState()
    var clockText by remember { mutableStateOf("") }
    var changePwDialogOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val fmt = SimpleDateFormat("dd MMM • HH:mm:ss", Locale.US)
        while (true) {
            clockText = fmt.format(Date())
            delay(1000L)
        }
    }

    val sess = state.session
    if (sess == null) {
        RoleGatewayScreen(
            repo = vm.repo,
            onPasswordLogin = { role, user, pw -> vm.signInWithPassword(role, user, pw) },
            onUnauthenticatedEnter = { role, opName -> vm.enterUnauthenticatedRole(role, opName) },
        )
        return
    }

    if (sess.user.mustChangePassword) {
        ForcedPasswordChangeDialog(
            user = sess.user,
            onSubmit = { curr, next -> vm.changePassword(curr, next) },
            onSignOut = { vm.signOut() },
        )
        return
    }

    if (sess.user.role == AppRole.DASHBOARD) {
        LiveCellStatusScreen(
            state = state,
            kioskMode = true,
            clockText = clockText,
            onRefresh = { vm.refreshData() },
            onExitKiosk = { vm.signOut() },
        )
        return
    }

    val allowed = remember(sess.user.role) { RolePolicy.allowedDestinations(sess.user.role) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isWideTablet = maxWidth >= 840.dp
        if (isWideTablet) {
            PermanentNavigationDrawer(
                drawerContent = {
                    PermanentDrawerSheet(modifier = Modifier.width(240.dp)) {
                        DrawerMenuBody(allowed, state.activeDest, onSelect = { vm.navigate(it) })
                    }
                },
            ) {
                MainScaffold(vm, state, allowed, clockText, showMenuIcon = false, onOpenMenu = {}, onOpenChangePw = { changePwDialogOpen = true })
            }
        } else {
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    ModalDrawerSheet {
                        DrawerMenuBody(
                            allowed = allowed,
                            activeDest = state.activeDest,
                            onSelect = { dest ->
                                vm.navigate(dest)
                                scope.launch { drawerState.close() }
                            },
                        )
                    }
                },
            ) {
                MainScaffold(
                    vm = vm,
                    state = state,
                    allowed = allowed,
                    clockText = clockText,
                    showMenuIcon = true,
                    onOpenMenu = { scope.launch { drawerState.open() } },
                    onOpenChangePw = { changePwDialogOpen = true },
                )
            }
        }
    }

    if (changePwDialogOpen) {
        ChangeOwnPasswordDialog(
            onDismiss = { changePwDialogOpen = false },
            onSubmit = { curr, next -> vm.changePassword(curr, next) },
        )
    }
}

@Composable
private fun DrawerMenuBody(allowed: List<NavDestination>, activeDest: NavDestination, onSelect: (NavDestination) -> Unit) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(10.dp)) {
        Text("PHA INDIA", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PhaColors.Accent, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
        Text("PRESS SHOP MFG-2", fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp))
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        allowed.forEach { dest ->
            NavigationDrawerItem(
                label = { Text(dest.title, fontSize = 13.sp) },
                selected = dest == activeDest,
                onClick = { onSelect(dest) },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScaffold(
    vm: AppViewModel,
    state: MainUiState,
    allowed: List<NavDestination>,
    clockText: String,
    showMenuIcon: Boolean,
    onOpenMenu: () -> Unit,
    onOpenChangePw: () -> Unit,
) {
    val sess = state.session ?: return
    var userMenuOpen by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = PhaColors.Canvas,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PhaColors.Surface),
                navigationIcon = {
                    if (showMenuIcon) {
                        IconButton(onClick = onOpenMenu) {
                            Icon(Icons.Default.Menu, contentDescription = "Open Navigation")
                        }
                    }
                },
                title = {
                    Column {
                        Text(state.activeDest.title, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text("${state.selectedPlant} • ${state.selectedDate} • ${state.selectedShift}", fontSize = 11.sp, color = PhaColors.InkMuted)
                    }
                },
                actions = {
                    Surface(border = BorderStroke(1.dp, PhaColors.BorderStrong), shape = RoundedCornerShape(4.dp)) {
                        Text(clockText, fontFamily = FontFamily.Monospace, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp))
                    }
                    IconButton(onClick = { userMenuOpen = true }) {
                        Icon(Icons.Default.Person, contentDescription = "User Menu")
                    }
                    DropdownMenu(expanded = userMenuOpen, onDismissRequest = { userMenuOpen = false }) {
                        DropdownMenuItem(text = { Text("${sess.user.fullName} (${sess.user.role.title})", fontWeight = FontWeight.Bold) }, onClick = {})
                        if (RolePolicy.capabilities(sess.user.role).canChangeOwnPassword) {
                            DropdownMenuItem(text = { Text("Change Password") }, onClick = { userMenuOpen = false; onOpenChangePw() })
                        }
                        DropdownMenuItem(text = { Text("Sign Out", color = PhaColors.StatusErrInk) }, onClick = { userMenuOpen = false; vm.signOut() })
                    }
                },
            )
        },
        bottomBar = {
            if (showMenuIcon && allowed.size > 1) {
                val quickTabs = allowed.take(4)
                NavigationBar(containerColor = PhaColors.Surface) {
                    quickTabs.forEach { dest ->
                        NavigationBarItem(
                            selected = dest == state.activeDest,
                            onClick = { vm.navigate(dest) },
                            icon = { Text(dest.label.take(2).uppercase(), fontWeight = FontWeight.Bold, fontSize = 11.sp) },
                            label = { Text(dest.label, fontSize = 10.sp, maxLines = 1) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.routeNotice.isNotBlank() || state.bannerMessage.isNotBlank()) {
                val isErr = state.bannerIsError || state.routeNotice.isNotBlank()
                Surface(color = if (isErr) PhaColors.StatusWarnBg else PhaColors.StatusOkBg, modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(state.routeNotice.ifBlank { state.bannerMessage }, fontSize = 12.sp, color = if (isErr) PhaColors.StatusWarnInk else PhaColors.StatusOkInk, modifier = Modifier.weight(1f))
                        TextButton(onClick = { vm.clearBanner() }) { Text("Dismiss") }
                    }
                }
            }

            when (state.activeDest) {
                NavDestination.DASHBOARD -> DashboardScreen(state, { p, d, s, g -> vm.setFilters(p, d, s, g) }, { vm.refreshData() }, { vm.navigate(it) })
                NavDestination.HOURLY_ENTRY -> HourlyEntryScreen(state, { d, s -> vm.setFilters(date = d, shift = s) }) { m, h, op, t, u, a, r, dt, c, reason, rem, sid ->
                    vm.submitHourlyProduction(m, h, op, t, u, a, r, dt, c, reason, rem, sid)
                }
                NavDestination.CELL_STATUS -> LiveCellStatusScreen(state, kioskMode = false, clockText = clockText, onRefresh = { vm.refreshData() }, onExitKiosk = { vm.signOut() })
                NavDestination.PRODUCTION -> ProductionOverviewScreen(state) { vm.savePlan(it) }
                NavDestination.MANPOWER -> ManpowerScreen(state)
                NavDestination.ATTENDANCE -> AttendanceScreen(state, { d, s -> vm.setFilters(date = d, shift = s) }) { vm.saveAttendanceMarks(it) }
                NavDestination.MACHINES -> MachinesScreen(state, { num, m, ver -> vm.saveMachineConfig(num, m, ver) }, { m -> vm.createMachine(m) })
                NavDestination.HANDOVERS -> HandoversScreen(state) { vm.saveHandover(it) }
                NavDestination.REPORTS -> ReportsScreen(state)
                NavDestination.USERS -> UsersScreen(state) { u, f, r, pw -> vm.createUser(u, f, r, pw) }
                NavDestination.AUDIT_LOG -> AuditLogScreen(state)
                NavDestination.SETTINGS -> SettingsScreen(
                    state = state,
                    cloudHost = vm.repo.configuredHostDisplay(),
                    usesRest = vm.repo.usesRestBackend,
                    onRunDiagnostics = { vm.runDiagnostics() },
                    onSaveRecoveryEmail = { vm.saveRecoveryEmail(it) },
                    onVerifyRecoveryEmail = { vm.verifyRecoveryEmail(it) },
                    onOpenChangePassword = onOpenChangePw,
                )
            }
        }
    }
}

@Composable
private fun ChangeOwnPasswordDialog(onDismiss: () -> Unit, onSubmit: suspend (String, String) -> String?) {
    var curr by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var err by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change Password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (err.isNotBlank()) Text(err, color = PhaColors.StatusErrInk, fontSize = 12.sp)
                OutlinedTextField(value = curr, onValueChange = { curr = it }, label = { Text("Current Password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                OutlinedTextField(value = next, onValueChange = { next = it }, label = { Text("New Strong Password (10+ chars)") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        val res = onSubmit(curr, next)
                        if (res != null) err = res else onDismiss()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
            ) { Text("Update") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
